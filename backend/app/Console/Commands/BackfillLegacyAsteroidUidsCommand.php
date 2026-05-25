<?php

namespace App\Console\Commands;

use App\Models\Swc\SwcSectorSearchRecord;
use Illuminate\Console\Command;

class BackfillLegacyAsteroidUidsCommand extends Command
{
    protected $signature = 'universe:backfill-legacy-asteroid-uids
        {file=backend/storage/app/legacy/System Search.txt : Path to the legacy SQL dump}
        {--overwrite : Replace existing asteroid_uid values when a legacy value exists}
        {--dry-run : Parse and report without writing changes}';

    protected $description = 'Backfill asteroid field UIDs on sector search records from the legacy System Search SQL dump.';

    public function handle(): int
    {
        $file = $this->resolveLegacyFilePath(trim((string) $this->argument('file')));
        $overwrite = (bool) $this->option('overwrite');
        $dryRun = (bool) $this->option('dry-run');

        if ($file === null || !is_file($file) || !is_readable($file)) {
            $this->error('The legacy SQL file could not be read.');

            return self::FAILURE;
        }

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

        $matchedAsteroidRows = 0;
        $updated = 0;
        $unchanged = 0;
        $missingRecord = 0;
        $missingUid = 0;
        $invalidRows = 0;

        foreach ($valueGroups as $index => $group) {
            $fields = str_getcsv($group, ',', "'", '\\');

            if (count($fields) < 11) {
                $invalidRows += 1;
                $this->warn(sprintf('Skipping row %d: expected 11 fields, got %d.', $index + 1, count($fields)));
                continue;
            }

            [
                $x,
                $y,
                $asteroids,
                $system,
                $note,
            ] = array_slice($fields, 0, 5);

            $galx = is_numeric($x) ? (int) $x : null;
            $galy = is_numeric($y) ? (int) $y : null;
            $hasAsteroids = $this->legacyFlagToBool($asteroids);

            if ($galx === null || $galy === null) {
                $invalidRows += 1;
                continue;
            }

            if (!$hasAsteroids) {
                continue;
            }

            $matchedAsteroidRows += 1;
            $asteroidUid = $this->extractAsteroidUid((string) $note);

            if ($asteroidUid === null) {
                $missingUid += 1;
                continue;
            }

            $record = SwcSectorSearchRecord::query()
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->first();

            if (!$record) {
                $missingRecord += 1;
                continue;
            }

            if (!$overwrite && !empty($record->asteroid_uid)) {
                $unchanged += 1;
                continue;
            }

            if ((string) $record->asteroid_uid === $asteroidUid) {
                $unchanged += 1;
                continue;
            }

            if ($dryRun) {
                $this->line(sprintf(
                    '[dry-run] update %d,%d -> %s',
                    $galx,
                    $galy,
                    $asteroidUid
                ));
                $updated += 1;
                continue;
            }

            $record->asteroid_uid = $asteroidUid;
            $record->save();
            $updated += 1;
        }

        $this->info(sprintf(
            'Legacy asteroid UID backfill complete. Asteroid rows parsed: %d, updated: %d, unchanged: %d, missing records: %d, missing UIDs: %d, invalid rows: %d.',
            $matchedAsteroidRows,
            $updated,
            $unchanged,
            $missingRecord,
            $missingUid,
            $invalidRows
        ));

        return self::SUCCESS;
    }

    protected function extractAsteroidUid(string $note): ?string
    {
        if ($note === '' || stripos($note, 'asteroids=1') === false) {
            return null;
        }

        if (!preg_match('/systemID=(\d+)/i', $note, $matches)) {
            return null;
        }

        return sprintf('5:%s', $matches[1]);
    }

    protected function legacyFlagToBool(mixed $value): bool
    {
        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes'], true);
    }

    protected function resolveLegacyFilePath(string $path): ?string
    {
        $trimmed = trim($path);
        if ($trimmed === '') {
            return null;
        }

        $candidates = [$trimmed];

        if (str_starts_with($trimmed, 'backend/')) {
            $candidates[] = substr($trimmed, strlen('backend/'));
        }

        if (!str_starts_with($trimmed, DIRECTORY_SEPARATOR)) {
            $candidates[] = base_path($trimmed);

            if (str_starts_with($trimmed, 'backend/')) {
                $candidates[] = base_path(substr($trimmed, strlen('backend/')));
            }
        }

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '' && is_file($candidate) && is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
