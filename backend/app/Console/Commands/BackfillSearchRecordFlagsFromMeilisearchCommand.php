<?php

namespace App\Console\Commands;

use App\Models\DroidBrainShip;
use App\Models\DroidBrainStation;
use App\Models\SwcSectorSearchRecord;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Meilisearch\Client as MeilisearchClient;
use Meilisearch\Contracts\DocumentsQuery;

class BackfillSearchRecordFlagsFromMeilisearchCommand extends Command
{
    protected $signature = 'droidbrain:backfill-search-record-flags-from-meili
        {--reindex-first : Rebuild DroidBrain ship/station Meilisearch indexes before reading coordinates}
        {--chunk=1000 : Hits per page when reading from Meilisearch}
        {--dry-run : Show what would change without writing to swc_sector_search_records}';

    protected $description = 'Backfill swc_sector_search_records has_ships/has_stations from Meilisearch-indexed DroidBrain coordinates.';

    public function handle(): int
    {
        $chunk = max(100, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $reindexFirst = (bool) $this->option('reindex-first');
        $includeApiStations = true;

        if ($reindexFirst) {
            $this->info('Reindexing DroidBrain ships/stations into Meilisearch first...');
            DroidBrainShip::makeAllSearchable();
            DroidBrainStation::makeAllSearchable();
            $this->info('Reindex complete.');
        }

        $coordFlags = [];

        [$shipKeys, $shipStats] = $this->collectCoordKeysFromMeili('droidbrain_ships', $chunk);
        foreach ($shipKeys as $key => $coord) {
            $coordFlags[$key] = [
                'galx' => $coord['galx'],
                'galy' => $coord['galy'],
                'has_ships' => true,
                'has_stations' => false,
            ];
        }

        [$stationKeys, $stationStats] = $this->collectCoordKeysFromMeili('droidbrain_stations', $chunk);
        foreach ($stationKeys as $key => $coord) {
            if (!isset($coordFlags[$key])) {
                $coordFlags[$key] = [
                    'galx' => $coord['galx'],
                    'galy' => $coord['galy'],
                    'has_ships' => false,
                    'has_stations' => true,
                ];
                continue;
            }

            $coordFlags[$key]['has_stations'] = true;
        }

        $apiStationCoords = 0;
        if ($includeApiStations) {
            DB::table('swc_stations')
                ->whereNotNull('galx')
                ->whereNotNull('galy')
                ->select('galx', 'galy')
                ->distinct()
                ->orderBy('id')
                ->chunk(5000, function ($rows) use (&$coordFlags, &$apiStationCoords) {
                    foreach ($rows as $row) {
                        $galx = (int) $row->galx;
                        $galy = (int) $row->galy;
                        $key = sprintf('%d:%d', $galx, $galy);
                        $apiStationCoords++;

                        if (!isset($coordFlags[$key])) {
                            $coordFlags[$key] = [
                                'galx' => $galx,
                                'galy' => $galy,
                                'has_ships' => false,
                                'has_stations' => true,
                            ];
                            continue;
                        }

                        $coordFlags[$key]['has_stations'] = true;
                    }
                });
        }

        $existingTrue = SwcSectorSearchRecord::query()
            ->where(function ($query) {
                $query->where('has_ships', true)
                    ->orWhere('has_stations', true);
            })
            ->get(['galx', 'galy']);

        foreach ($existingTrue as $record) {
            $key = sprintf('%d:%d', (int) $record->galx, (int) $record->galy);
            if (isset($coordFlags[$key])) {
                continue;
            }

            $coordFlags[$key] = [
                'galx' => (int) $record->galx,
                'galy' => (int) $record->galy,
                'has_ships' => false,
                'has_stations' => false,
            ];
        }

        if ($coordFlags === []) {
            $this->warn('No Meilisearch coordinates were found for ships or stations.');
            return self::SUCCESS;
        }

        $rows = [];
        $timestamp = now();
        foreach ($coordFlags as $coord) {
            $rows[] = [
                'galx' => $coord['galx'],
                'galy' => $coord['galy'],
                'is_system_searched' => false,
                'has_asteroids' => false,
                'has_ships' => (bool) $coord['has_ships'],
                'has_stations' => (bool) $coord['has_stations'],
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        $existingByKey = SwcSectorSearchRecord::query()
            ->whereIn('galx', array_values(array_unique(array_column($rows, 'galx'))))
            ->whereIn('galy', array_values(array_unique(array_column($rows, 'galy'))))
            ->get(['id', 'galx', 'galy', 'has_ships', 'has_stations'])
            ->keyBy(fn (SwcSectorSearchRecord $record) => sprintf('%d:%d', (int) $record->galx, (int) $record->galy));

        $creates = 0;
        $updates = 0;
        foreach ($rows as $row) {
            $key = sprintf('%d:%d', (int) $row['galx'], (int) $row['galy']);
            $existing = $existingByKey->get($key);
            if (!$existing) {
                $creates++;
                continue;
            }

            if ((bool) $existing->has_ships !== (bool) $row['has_ships'] || (bool) $existing->has_stations !== (bool) $row['has_stations']) {
                $updates++;
            }
        }

        $this->line(sprintf('Ship index docs scanned: %d (missing coords: %d)', $shipStats['docs_scanned'], $shipStats['missing_coords']));
        $this->line(sprintf('Station index docs scanned: %d (missing coords: %d)', $stationStats['docs_scanned'], $stationStats['missing_coords']));
        if ($includeApiStations) {
            $this->line(sprintf('SWC API station coordinate rows scanned: %d', $apiStationCoords));
        }
        $this->line(sprintf('Unique coordinates from combined sources: %d', count($coordFlags)));
        $this->line(sprintf('Search records to create: %d', $creates));
        $this->line(sprintf('Search records to update: %d', $updates));

        if ($dryRun) {
            $this->info('Dry run complete. No database writes were performed.');
            return self::SUCCESS;
        }

        foreach (array_chunk($rows, 1000) as $chunkRows) {
            DB::table('swc_sector_search_records')->upsert(
                $chunkRows,
                ['galx', 'galy'],
                ['has_ships', 'has_stations', 'updated_at']
            );
        }

        $this->info('Backfill completed from Meilisearch.');
        return self::SUCCESS;
    }

    /**
     * @return array{0: array<string, array{galx:int,galy:int}>, 1: array{docs_scanned:int,missing_coords:int}}
     */
    protected function collectCoordKeysFromMeili(string $indexName, int $hitsPerPage): array
    {
        $client = app(MeilisearchClient::class);
        $index = $client->index($indexName);

        $offset = 0;
        $keys = [];
        $docsScanned = 0;
        $missingCoords = 0;

        while (true) {
            $query = (new DocumentsQuery())
                ->setFields(['entity_uid', 'galx', 'galy'])
                ->setLimit($hitsPerPage)
                ->setOffset($offset);

            $payload = $index->getDocuments($query);
            $hits = $payload->getResults();

            if (!is_array($hits) || $hits === []) {
                break;
            }

            foreach ($hits as $hit) {
                $docsScanned++;
                $galx = isset($hit['galx']) && is_numeric((string) $hit['galx']) ? (int) $hit['galx'] : null;
                $galy = isset($hit['galy']) && is_numeric((string) $hit['galy']) ? (int) $hit['galy'] : null;

                if ($galx === null || $galy === null) {
                    $missingCoords++;
                    continue;
                }

                $key = sprintf('%d:%d', $galx, $galy);
                $keys[$key] = ['galx' => $galx, 'galy' => $galy];
            }

            if (count($hits) < $hitsPerPage) {
                break;
            }

            $offset += $hitsPerPage;
        }

        return [
            $keys,
            [
                'docs_scanned' => $docsScanned,
                'missing_coords' => $missingCoords,
            ],
        ];
    }
}
