<?php

namespace App\Console\Commands;

use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use Illuminate\Console\Command;

class ImportLegacyPlayerNotesCommand extends Command
{
    protected $signature = 'universe:import-legacy-player-notes
        {file : Path to a legacy SQL dump containing player note INSERT rows}
        {--mode=fill : How to import notes: skip, fill, or overwrite}
        {--sample-skipped=20 : Number of skipped coordinate samples to print in dry-run output}
        {--dry-run : Parse and report without writing changes}';

    protected $description = 'Import legacy player note rows into shared galaxy cell annotations.';

    public function handle(): int
    {
        $file = trim((string) $this->argument('file'));
        $dryRun = (bool) $this->option('dry-run');
        $mode = trim(strtolower((string) $this->option('mode')));
        $sampleSkipped = max(0, (int) $this->option('sample-skipped'));

        if (!in_array($mode, ['skip', 'fill', 'overwrite'], true)) {
            $this->error('Invalid --mode value. Use skip, fill, or overwrite.');

            return self::FAILURE;
        }

        if (!is_file($file) || !is_readable($file)) {
            $this->error('The legacy SQL file could not be read.');

            return self::FAILURE;
        }

        $coordinateMap = $this->buildSectorCoordinateMap();
        if ($coordinateMap === []) {
            $this->error('No stored sector coordinate data was found. Pull sectors before importing legacy player notes.');

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
        $withoutSector = 0;
        $skippedInBounds = 0;
        $skippedOutOfBounds = 0;
        $skippedSamples = [];
        $malformedSamples = [];

        foreach ($valueGroups as $index => $group) {
            $fields = str_getcsv($group, ',', "'", '\\');

            if (count($fields) < 5) {
                $skipped += 1;
                if (count($malformedSamples) < $sampleSkipped) {
                    $malformedSamples[] = [
                        'row' => $index + 1,
                        'field_count' => count($fields),
                        'galx' => $this->formatSkippedValue($fields[0] ?? null),
                        'galy' => $this->formatSkippedValue($fields[1] ?? null),
                        'note' => $this->formatSkippedValue($fields[2] ?? null),
                    ];
                }
                continue;
            }

            [$x, $y, $note, $timestamp, $player] = $fields;

            $galx = is_numeric($x) ? (int) $x : null;
            $galy = is_numeric($y) ? (int) $y : null;
            $legacyNote = $this->normalizeLegacyPlayerNote((string) $note);

            if ($galx === null || $galy === null || $legacyNote === null) {
                $skipped += 1;
                $this->warn(sprintf('Skipping row %d: invalid coordinates or empty note.', $index + 1));
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

            if (!$sector) {
                $withoutSector += 1;
                $skipped += 1;
                continue;
            }

            $legacyTimestamp = is_numeric($timestamp)
                ? now()->setTimestamp((int) $timestamp)
                : null;

            $existing = SwcSectorCellAnnotation::query()
                ->where('sector_uid', $sector->uid)
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->first();

            if ($dryRun) {
                $this->line(sprintf(
                    '[dry-run] %s %d,%d note=%s player=%s mode=%s sector=%s',
                    $existing ? 'update' : 'create',
                    $galx,
                    $galy,
                    'yes',
                    trim((string) $player) ?: 'unknown',
                    $mode,
                    $sector->uid
                ));
                continue;
            }

            if ($mode === 'skip') {
                $skipped += 1;
                continue;
            }

            if ($existing) {
                $existingNote = trim((string) ($existing->notes ?? ''));

                if ($mode === 'fill' && $existingNote !== '') {
                    $skipped += 1;
                    continue;
                }

                $existing->fill([
                    'sector_id' => $sector->id,
                    'notes' => $legacyNote,
                    'updated_by' => null,
                ]);

                if ($legacyTimestamp) {
                    $existing->updated_at = $legacyTimestamp;
                    if (!$existing->created_at) {
                        $existing->created_at = $legacyTimestamp;
                    }
                }

                $existing->save();
                $updated += 1;
                continue;
            }

            $annotation = SwcSectorCellAnnotation::query()->create([
                'sector_id' => $sector->id,
                'sector_uid' => $sector->uid,
                'galx' => $galx,
                'galy' => $galy,
                'marker_type' => null,
                'label' => null,
                'notes' => $legacyNote,
                'created_by' => null,
                'updated_by' => null,
            ]);

            if ($legacyTimestamp) {
                $annotation->timestamps = false;
                $annotation->created_at = $legacyTimestamp;
                $annotation->updated_at = $legacyTimestamp;
                $annotation->save();
            }

            $created += 1;
        }

        if ($dryRun) {
            $this->info(sprintf(
                'Dry run completed for %d parsed rows. %d skipped. Mode: %s.',
                count($valueGroups),
                $skipped,
                $mode
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

            if ($malformedSamples !== []) {
                $this->line('Malformed skipped rows:');
                foreach ($malformedSamples as $sample) {
                    $this->line(sprintf(
                        '  row %d -> x=%s y=%s note=%s (fields=%d)',
                        $sample['row'],
                        $sample['galx'],
                        $sample['galy'],
                        $sample['note'],
                        $sample['field_count']
                    ));
                }
            }

            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Legacy player note import complete. Notes created: %d, updated: %d, skipped: %d. Without sector: %d.',
            $created,
            $updated,
            $skipped,
            $withoutSector
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

            if ($points !== []) {
                $index[$uid] = $points;
            }
        }

        return $index;
    }

    /**
     * @param  array<int, array{uid: string, name: string|null}>  $candidateSectors
     * @param  array<string, SwcSector>  $sectorsByUid
     * @param  array<string, array<int, array{galx: int, galy: int}>>  $sectorPointIndex
     */
    protected function findNearestSectorByCoordinates(
        int $galx,
        int $galy,
        array $candidateSectors,
        array $sectorsByUid,
        array $sectorPointIndex
    ): ?SwcSector {
        $bestSector = null;
        $bestDistance = null;

        foreach ($candidateSectors as $candidate) {
            $uid = (string) ($candidate['uid'] ?? '');
            if ($uid === '' || !isset($sectorsByUid[$uid], $sectorPointIndex[$uid])) {
                continue;
            }

            foreach ($sectorPointIndex[$uid] as $point) {
                $distance = abs($galx - $point['galx']) + abs($galy - $point['galy']);

                if ($bestDistance === null || $distance < $bestDistance) {
                    $bestDistance = $distance;
                    $bestSector = $sectorsByUid[$uid];
                }
            }
        }

        return $bestSector;
    }

    protected function coordinateKey(int $galx, int $galy): string
    {
        return sprintf('%d:%d', $galx, $galy);
    }

    protected function normalizeLegacyPlayerNote(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $decoded = html_entity_decode($trimmed, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $normalizedLineBreaks = str_replace(["\r\n", "\r"], "\n", $decoded);
        $stripped = trim(strip_tags($normalizedLineBreaks));

        return $stripped !== '' ? $stripped : null;
    }

    protected function formatSkippedValue(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));

        if ($text === '') {
            return 'n/a';
        }

        $normalized = preg_replace('/\s+/', ' ', $text) ?? $text;

        if (mb_strlen($normalized) > 120) {
            return mb_substr($normalized, 0, 117) . '...';
        }

        return $normalized;
    }
}
