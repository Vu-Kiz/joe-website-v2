<?php

namespace App\Console\Commands;

use App\Models\Swc\SwcSector;
use App\Models\Swc\SwcSectorSearchRecord;
use Illuminate\Console\Command;

class ImportLegacySectorSearchesCommand extends Command
{
    protected $signature = 'universe:import-legacy-sector-searches
        {file : Path to a legacy SQL dump containing INSERT rows}
        {--notes-mode=fill : How to import legacy note text: skip, fill, or overwrite}
        {--sample-skipped=20 : Number of skipped coordinate samples to print in dry-run output}
        {--dry-run : Parse and report without writing changes}';

    protected $description = 'Import legacy searched-system grid rows into search records and map old system-note names into square_name for galaxy display.';

    public function handle(): int
    {
        $file = trim((string) $this->argument('file'));
        $dryRun = (bool) $this->option('dry-run');
        $notesMode = trim(strtolower((string) $this->option('notes-mode')));
        $sampleSkipped = max(0, (int) $this->option('sample-skipped'));

        if (!in_array($notesMode, ['skip', 'fill', 'overwrite'], true)) {
            $this->error('Invalid --notes-mode value. Use skip, fill, or overwrite.');

            return self::FAILURE;
        }

        if (!is_file($file) || !is_readable($file)) {
            $this->error('The legacy SQL file could not be read.');

            return self::FAILURE;
        }

        $coordinateMap = $this->buildSectorCoordinateMap();
        if ($coordinateMap === []) {
            $this->error('No stored sector coordinate data was found. Pull sectors before importing legacy search data.');

            return self::FAILURE;
        }
        $sectorsByUid = $this->buildSectorsByUidIndex($coordinateMap);
        $sectorPointIndex = $this->buildSectorPointIndex($sectorsByUid);
        $sectorBounds = $this->buildSectorBoundsIndex();

        $content = file_get_contents($file);
        if ($content === false) {
            $this->error('Failed to read the legacy SQL file.');

            return self::FAILURE;
        }

        preg_match_all('/VALUES\\s*\\((.*?)\\);/is', $content, $matches);
        $valueGroups = $matches[1] ?? [];

        if ($valueGroups === []) {
            $this->warn('No INSERT value groups were found in the file.');

            return self::SUCCESS;
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $searchRecordsWithoutSector = 0;
        $skippedInBounds = 0;
        $skippedOutOfBounds = 0;
        $skippedSamples = [];

        foreach ($valueGroups as $index => $group) {
            $fields = str_getcsv($group, ',', "'", '\\');

            if (count($fields) < 11) {
                $skipped += 1;
                $this->warn(sprintf('Skipping row %d: expected 11 fields, got %d.', $index + 1, count($fields)));
                continue;
            }

            [
                $x,
                $y,
                $asteroids,
                $system,
                $note,
                $timestamp,
                $player,
                $icon,
                $handle,
                $tag,
                $read,
            ] = $fields;

            $galx = is_numeric($x) ? (int) $x : null;
            $galy = is_numeric($y) ? (int) $y : null;

            if ($galx === null || $galy === null) {
                $skipped += 1;
                $this->warn(sprintf('Skipping row %d: invalid coordinates.', $index + 1));
                continue;
            }

            $sector = $coordinateMap[$this->coordinateKey($galx, $galy)] ?? null;
            $boundsMatches = [];

            if (!$sector) {
                $boundsMatches = $this->findSectorsByBounds($galx, $galy, $sectorBounds);

                if (count($boundsMatches) === 1) {
                    $matchedSector = $boundsMatches[0];
                    $sector = $sectorsByUid[$matchedSector['uid']] ?? null;
                } elseif (count($boundsMatches) > 1) {
                    $sector = $this->findNearestSectorByCoordinates(
                        $galx,
                        $galy,
                        $boundsMatches,
                        $sectorsByUid,
                        $sectorPointIndex
                    );
                }
            }

            if (!$sector && $boundsMatches !== []) {
                $skippedInBounds += 1;
            } elseif (!$sector) {
                $skippedOutOfBounds += 1;
            }

            if (!$sector && count($skippedSamples) < $sampleSkipped) {
                $skippedSamples[] = [
                    'row' => $index + 1,
                    'galx' => $galx,
                    'galy' => $galy,
                    'bounds_match_uid' => count($boundsMatches) === 1 ? ($boundsMatches[0]['uid'] ?? null) : null,
                    'bounds_match_name' => count($boundsMatches) === 1 ? ($boundsMatches[0]['name'] ?? null) : null,
                    'bounds_match_count' => count($boundsMatches),
                ];
            }

            $legacyTimestamp = is_numeric($timestamp)
                ? now()->setTimestamp((int) $timestamp)
                : null;

            $legacySquareName = $this->normalizeLegacySquareName((string) $note);
            $isSystemSearched = $this->legacyFlagToBool($system);
            $hasAsteroids = $this->legacyFlagToBool($asteroids);

            $attributes = [
                'sector_id' => $sector?->id,
                'sector_uid' => $sector?->uid,
                'square_name' => $legacySquareName,
                'is_system_searched' => $isSystemSearched,
                'has_asteroids' => $hasAsteroids,
                'legacy_note' => null,
                'legacy_recorded_at' => $legacyTimestamp,
                'rescan_due_at' => $legacyTimestamp?->copy()->addMonthsNoOverflow(6),
                'legacy_player' => trim((string) $player) ?: null,
                'legacy_icon' => trim((string) $icon) ?: null,
                'legacy_handle' => trim((string) $handle) ?: null,
                'legacy_tag' => trim((string) $tag) ?: null,
                'legacy_read' => $this->legacyFlagToBool($read),
            ];

            $existing = SwcSectorSearchRecord::query()
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->first();

            if ($dryRun) {
                $this->line(sprintf(
                    '[dry-run] %s %d,%d searched=%s asteroids=%s note=%s notes_mode=%s sector=%s',
                    $existing ? 'update' : 'create',
                    $galx,
                    $galy,
                    $isSystemSearched ? 'yes' : 'no',
                    $hasAsteroids ? 'yes' : 'no',
                    $legacySquareName !== null ? 'yes' : 'no',
                    $notesMode,
                    $sector?->uid ?? 'none'
                ));
                continue;
            }

            $record = SwcSectorSearchRecord::updateOrCreate(
                [
                    'galx' => $galx,
                    'galy' => $galy,
                ],
                $attributes
            );

            if ($existing) {
                $updated += 1;
            } else {
                $created += 1;
            }

            if (!$sector) {
                $searchRecordsWithoutSector += 1;
            }

            $this->line(sprintf(
                '%s %d,%d -> search record #%d%s',
                $existing ? 'Updated' : 'Created',
                $galx,
                $galy,
                $record->id,
                $sector ? '' : ' (no sector)'
            ));
        }

        if ($dryRun) {
            $this->info(sprintf(
                'Dry run completed for %d parsed rows. %d skipped. Notes mode: %s.',
                count($valueGroups),
                $skipped,
                $notesMode
            ));

            $this->line(sprintf(
                'Sector resolution summary: unresolved but inside stored sector bounds = %d, unresolved outside all stored sector bounds = %d.',
                $skippedInBounds,
                $skippedOutOfBounds
            ));

            if ($skippedSamples !== []) {
                $this->line('Skipped sample rows:');
                foreach ($skippedSamples as $sample) {
                    $this->line(sprintf(
                        '  row %d -> %d,%d | bounds match: %s',
                        $sample['row'],
                        $sample['galx'],
                        $sample['galy'],
                        $sample['bounds_match_uid']
                            ? sprintf(
                                '%s (%s)',
                                $sample['bounds_match_name'] ?? 'Unknown sector',
                                $sample['bounds_match_uid']
                            )
                            : (($sample['bounds_match_count'] ?? 0) > 1
                                ? sprintf('ambiguous (%d sectors)', (int) $sample['bounds_match_count'])
                                : 'none')
                    ));
                }
            }

            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Legacy search import complete. Search records created: %d, updated: %d, skipped: %d. Without sector: %d.',
            $created,
            $updated,
            $skipped,
            $searchRecordsWithoutSector
        ));

        return self::SUCCESS;
    }

    /**
     * @return array<string, SwcSector>
     */
    protected function buildSectorCoordinateMap(): array
    {
        $map = [];

        $sectors = SwcSector::query()
            ->whereNotNull('outline_coordinates')
            ->get(['id', 'uid', 'name', 'outline_coordinates']);

        foreach ($sectors as $sector) {
            foreach ((array) $sector->outline_coordinates as $coordinate) {
                if (!is_array($coordinate)) {
                    continue;
                }

                $galx = isset($coordinate['galx']) && is_numeric($coordinate['galx'])
                    ? (int) $coordinate['galx']
                    : null;
                $galy = isset($coordinate['galy']) && is_numeric($coordinate['galy'])
                    ? (int) $coordinate['galy']
                    : null;

                if ($galx === null || $galy === null) {
                    continue;
                }

                $map[$this->coordinateKey($galx, $galy)] = $sector;
            }
        }

        return $map;
    }

    /**
     * @param  array<string, SwcSector>  $coordinateMap
     * @return array<string, SwcSector>
     */
    protected function buildSectorsByUidIndex(array $coordinateMap): array
    {
        $map = [];

        foreach ($coordinateMap as $sector) {
            $map[$sector->uid] = $sector;
        }

        return $map;
    }

    /**
     * @return array<int, array{uid: string, name: string|null, bounds: array<string, mixed>}>
     */
    protected function buildSectorBoundsIndex(): array
    {
        return SwcSector::query()
            ->whereNotNull('bounds')
            ->get(['uid', 'name', 'bounds'])
            ->map(function (SwcSector $sector): ?array {
                $bounds = is_array($sector->bounds) ? $sector->bounds : null;
                if (!$bounds) {
                    return null;
                }

                $required = ['min_galx', 'max_galx', 'min_galy', 'max_galy'];
                foreach ($required as $key) {
                    if (!isset($bounds[$key]) || !is_numeric($bounds[$key])) {
                        return null;
                    }
                }

                return [
                    'uid' => $sector->uid,
                    'name' => $sector->name,
                    'bounds' => $bounds,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{uid: string, name: string|null, bounds: array<string, mixed>}>  $sectorBounds
     * @return array<int, array{uid: string, name: string|null}>
     */
    protected function findSectorsByBounds(int $galx, int $galy, array $sectorBounds): array
    {
        $matches = [];

        foreach ($sectorBounds as $sector) {
            $bounds = $sector['bounds'];

            if (
                $galx >= (int) $bounds['min_galx'] &&
                $galx <= (int) $bounds['max_galx'] &&
                $galy >= (int) $bounds['min_galy'] &&
                $galy <= (int) $bounds['max_galy']
            ) {
                $matches[] = [
                    'uid' => $sector['uid'],
                    'name' => $sector['name'],
                ];
            }
        }

        return $matches;
    }

    /**
     * @param  array<string, SwcSector>  $sectorsByUid
     * @return array<string, array<int, array{galx: int, galy: int}>>
     */
    protected function buildSectorPointIndex(array $sectorsByUid): array
    {
        $index = [];

        foreach ($sectorsByUid as $uid => $sector) {
            $points = [];

            foreach ((array) $sector->outline_coordinates as $coordinate) {
                if (!is_array($coordinate)) {
                    continue;
                }

                if (!isset($coordinate['galx'], $coordinate['galy'])) {
                    continue;
                }

                if (!is_numeric($coordinate['galx']) || !is_numeric($coordinate['galy'])) {
                    continue;
                }

                $points[] = [
                    'galx' => (int) $coordinate['galx'],
                    'galy' => (int) $coordinate['galy'],
                ];
            }

            $index[$uid] = $points;
        }

        return $index;
    }

    /**
     * @param  array<int, array{uid: string, name: string|null}>  $boundsMatches
     * @param  array<string, SwcSector>  $sectorsByUid
     * @param  array<string, array<int, array{galx: int, galy: int}>>  $sectorPointIndex
     */
    protected function findNearestSectorByCoordinates(
        int $galx,
        int $galy,
        array $boundsMatches,
        array $sectorsByUid,
        array $sectorPointIndex
    ): ?SwcSector {
        $bestSector = null;
        $bestDistance = null;
        $isTie = false;

        foreach ($boundsMatches as $match) {
            $uid = $match['uid'];
            $sector = $sectorsByUid[$uid] ?? null;
            $points = $sectorPointIndex[$uid] ?? [];

            if (!$sector || $points === []) {
                continue;
            }

            $nearestDistance = null;

            foreach ($points as $point) {
                $distance = (($point['galx'] - $galx) ** 2) + (($point['galy'] - $galy) ** 2);

                if ($nearestDistance === null || $distance < $nearestDistance) {
                    $nearestDistance = $distance;
                }
            }

            if ($nearestDistance === null) {
                continue;
            }

            if ($bestDistance === null || $nearestDistance < $bestDistance) {
                $bestDistance = $nearestDistance;
                $bestSector = $sector;
                $isTie = false;
            } elseif ($nearestDistance === $bestDistance) {
                $isTie = true;
            }
        }

        if ($isTie) {
            return null;
        }

        return $bestSector;
    }

    protected function coordinateKey(int $galx, int $galy): string
    {
        return sprintf('%d:%d', $galx, $galy);
    }

    protected function normalizeLegacySquareName(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $decoded = html_entity_decode($trimmed, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $stripped = trim(strip_tags($decoded));

        return $stripped !== '' ? $stripped : null;
    }

    protected function legacyFlagToBool(string $value): bool
    {
        $normalized = trim(strtolower($value));

        return in_array($normalized, ['1', 'true', 'yes', 'y'], true);
    }
}
