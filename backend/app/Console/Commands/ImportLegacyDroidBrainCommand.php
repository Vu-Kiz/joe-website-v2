<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Throwable;

class ImportLegacyDroidBrainCommand extends Command
{
    protected $signature = 'droidbrain:import-legacy
        {file? : Path to a legacy SQL dump containing DroidBrain INSERT rows}
        {--connection=legacy : Legacy database connection name}
        {--chunk=500 : Number of rows to process per chunk}
        {--only= : Comma-separated list of tables to import}
        {--dry-run : Report what would be imported without writing}
        {--fresh : Truncate imported DroidBrain tables before importing}';

    protected $description = 'Import legacy DroidBrain tables from a legacy database connection or SQL dump into the new schema.';

    protected array $tableOrder = [
        'uploaders',
        'files',
        'known_systems',
        'cities',
        'npcs',
        'planets',
        'ships',
        'stations',
        'vehicles',
        'system_scans',
        'system_scan_objects',
        'upload_debug_requests',
        'upload_debug_events',
    ];

    public function handle(): int
    {
        $file = trim((string) ($this->argument('file') ?? ''));
        $connectionName = trim((string) $this->option('connection'));
        $chunkSize = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $fresh = (bool) $this->option('fresh');
        $selected = $this->normalizeSelectedTables((string) $this->option('only'));

        $importPlan = array_values(array_filter(
            $this->tableOrder,
            fn (string $table): bool => $selected === [] || in_array($table, $selected, true)
        ));

        if ($importPlan === []) {
            $this->warn('No import targets selected.');

            return self::SUCCESS;
        }

        if ($fresh && !$dryRun) {
            $this->truncateImportTargets($importPlan);
        }

        if ($file !== '') {
            return $this->importFromSqlFile($file, $importPlan, $chunkSize, $dryRun);
        }

        try {
            $source = DB::connection($connectionName);
            $source->getPdo();
        } catch (Throwable $e) {
            $this->error(sprintf(
                'Could not connect to the legacy database connection "%s": %s',
                $connectionName,
                $e->getMessage()
            ));

            return self::FAILURE;
        }

        $summary = [];

        foreach ($importPlan as $key) {
            $legacyTable = $this->legacyTableName($key);
            $targetTable = $this->targetTableName($key);
            $effectiveChunkSize = $this->effectiveChunkSize($key, $chunkSize);

            if (!$this->legacyTableExists($source, $legacyTable)) {
                $this->warn(sprintf('Skipping %s: legacy table "%s" was not found.', $key, $legacyTable));
                continue;
            }

            $count = (int) $source->table($legacyTable)->count();
            $this->line(sprintf('Importing %s from %s (%d rows)...', $key, $legacyTable, $count));

            $processed = 0;

            $source->table($legacyTable)
                ->orderBy('id')
                ->chunk($effectiveChunkSize, function (Collection $rows) use ($key, $targetTable, $dryRun, &$processed) {
                    $payload = $rows
                        ->map(fn ($row) => $this->mapLegacyRow($key, (array) $row))
                        ->filter()
                        ->values()
                        ->all();

                    $processed += count($payload);

                    if ($payload === [] || $dryRun) {
                        return;
                    }

                    DB::table($targetTable)->upsert(
                        $payload,
                        ['id'],
                        array_values(array_filter(array_keys($payload[0]), fn ($column) => $column !== 'id'))
                    );
                });

            $summary[] = [
                'key' => $key,
                'legacy_table' => $legacyTable,
                'target_table' => $targetTable,
                'rows' => $count,
                'processed' => $processed,
            ];
        }

        foreach ($summary as $row) {
            $this->info(sprintf(
                '%s: %d/%d rows %s',
                $row['key'],
                $row['processed'],
                $row['rows'],
                $dryRun ? 'validated' : 'imported'
            ));
        }

        $this->info($dryRun ? 'Legacy DroidBrain dry run complete.' : 'Legacy DroidBrain import complete.');

        return self::SUCCESS;
    }

    protected function importFromSqlFile(string $file, array $importPlan, int $chunkSize, bool $dryRun): int
    {
        $resolvedFile = $this->resolveSqlFilePath($file);

        if ($resolvedFile === null) {
            $this->error('The legacy SQL file could not be read.');

            return self::FAILURE;
        }

        $summary = [];
        foreach ($importPlan as $key) {
            $summary[$key] = [
                'key' => $key,
                'legacy_table' => $this->legacyTableName($key),
                'target_table' => $this->targetTableName($key),
                'rows' => 0,
                'processed' => 0,
            ];

            $this->streamSqlFileForTable(
                $resolvedFile,
                $key,
                $summary,
                $this->effectiveChunkSize($key, $chunkSize),
                $dryRun
            );
        }

        foreach ($summary as $row) {
            if ($row['rows'] === 0) {
                $this->warn(sprintf('Skipping %s: no INSERT rows were found for "%s".', $row['key'], $row['legacy_table']));
                continue;
            }

            $this->info(sprintf(
                '%s: %d/%d rows %s',
                $row['key'],
                $row['processed'],
                $row['rows'],
                $dryRun ? 'validated' : 'imported'
            ));
        }

        $this->info($dryRun ? 'Legacy DroidBrain SQL dry run complete.' : 'Legacy DroidBrain SQL import complete.');

        return self::SUCCESS;
    }

    protected function streamSqlFileForTable(
        string $resolvedFile,
        string $key,
        array &$summary,
        int $chunkSize,
        bool $dryRun
    ): void {
        $legacyTable = $this->legacyTableName($key);
        $handle = fopen($resolvedFile, 'rb');

        if ($handle === false) {
            throw new \RuntimeException('Failed to open the legacy SQL file.');
        }

        $currentTable = null;
        $statement = '';

        try {
            while (($line = fgets($handle)) !== false) {
                if ($currentTable === null) {
                    if (!preg_match('/INSERT\\s+INTO\\s+`([^`]+)`/i', $line, $match)) {
                        continue;
                    }

                    $tableName = $match[1] ?? null;
                    if ($tableName !== $legacyTable) {
                        continue;
                    }

                    $currentTable = $tableName;
                    $statement = $line;

                    if (str_contains($line, ';')) {
                        $this->processSqlInsertStatement($statement, $key, $summary, $chunkSize, $dryRun);
                        $currentTable = null;
                        $statement = '';
                    }

                    continue;
                }

                $statement .= $line;

                if (str_contains($line, ';')) {
                    $this->processSqlInsertStatement($statement, $key, $summary, $chunkSize, $dryRun);
                    $currentTable = null;
                    $statement = '';
                }
            }
        } finally {
            fclose($handle);
        }
    }

    protected function effectiveChunkSize(string $key, int $requestedChunkSize): int
    {
        return match ($key) {
            'files' => min(10, max(1, $requestedChunkSize)),
            'ships', 'stations', 'cities', 'vehicles' => min(250, max(1, $requestedChunkSize)),
            default => max(1, $requestedChunkSize),
        };
    }

    protected function processSqlInsertStatement(
        string $statement,
        string $key,
        array &$summary,
        int $chunkSize,
        bool $dryRun
    ): void {
        if (!preg_match('/INSERT\\s+INTO\\s+`[^`]+`\\s*\\((.*?)\\)\\s*VALUES\\s*(.*);/is', $statement, $match)) {
            return;
        }

        $columns = array_map(
            static fn (string $column): string => trim($column, " \t\n\r\0\x0B`"),
            explode(',', (string) ($match[1] ?? ''))
        );

        $groups = $this->splitSqlValueGroups((string) ($match[2] ?? ''));
        if ($groups === []) {
            return;
        }

        $legacyTable = $this->legacyTableName($key);
        $targetTable = $this->targetTableName($key);

        if (($summary[$key]['rows'] ?? 0) === 0) {
            $this->line(sprintf('Importing %s from %s...', $key, $legacyTable));
        }

        $summary[$key]['rows'] += count($groups);

        foreach (array_chunk($groups, $chunkSize) as $chunk) {
            $payload = [];

            foreach ($chunk as $group) {
                $fields = str_getcsv($group, ',', "'", "\\");
                if (count($fields) !== count($columns)) {
                    continue;
                }

                $row = [];
                foreach ($columns as $index => $column) {
                    $row[$column] = $this->normalizeSqlValue($fields[$index] ?? null);
                }

                $mapped = $this->mapLegacyRow($key, $row);
                if ($mapped !== null) {
                    $payload[] = $mapped;
                }
            }

            $summary[$key]['processed'] += count($payload);

            if ($payload === [] || $dryRun) {
                continue;
            }

            DB::table($targetTable)->upsert(
                $payload,
                ['id'],
                array_values(array_filter(array_keys($payload[0]), fn ($column) => $column !== 'id'))
            );
        }
    }

    protected function resolveSqlFilePath(string $file): ?string
    {
        $candidates = [
            $file,
            base_path($file),
        ];

        if (str_starts_with($file, 'backend/')) {
            $candidates[] = base_path(substr($file, strlen('backend/')));
        }

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && is_file($candidate) && is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    protected function normalizeSelectedTables(string $only): array
    {
        if (trim($only) === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (string $value): string => trim($value),
            explode(',', strtolower($only))
        )));
    }

    protected function truncateImportTargets(array $importPlan): void
    {
        $truncateOrder = array_reverse($importPlan);

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            foreach ($truncateOrder as $key) {
                DB::table($this->targetTableName($key))->truncate();
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    protected function legacyTableExists(Connection $source, string $table): bool
    {
        return $source->getSchemaBuilder()->hasTable($table);
    }

    protected function legacyTableName(string $key): string
    {
        return match ($key) {
            'uploaders' => 'droidbrain_uploaders',
            'files' => 'droidbrain_files',
            'known_systems' => 'droidbrain_known_systems',
            'cities' => 'droidbrain_cities',
            'npcs' => 'droidbrain_npcs',
            'planets' => 'droidbrain_planets',
            'ships' => 'droidbrain_ships',
            'stations' => 'droidbrain_stations',
            'vehicles' => 'droidbrain_vehicles',
            'system_scans' => 'droidbrain_system_scans',
            'system_scan_objects' => 'droidbrain_system_scan_objects',
            'upload_debug_requests' => 'droidbrain_upload_debug_requests',
            'upload_debug_events' => 'droidbrain_upload_debug_events',
            default => throw new \InvalidArgumentException("Unknown legacy table key [{$key}]"),
        };
    }

    protected function targetTableName(string $key): string
    {
        return $this->legacyTableName($key);
    }

    protected function mapLegacyRow(string $key, array $row): ?array
    {
        return match ($key) {
            'uploaders' => [
                'id' => $row['id'],
                'user_id' => null,
                'swc_uid' => $row['swc_uid'] ?? null,
                'handle' => $row['handle'] ?? null,
                'is_guest' => (bool) ($row['is_guest'] ?? false),
                'meta' => $this->encodeMeta([
                    'avatar_url' => $row['avatar_url'] ?? null,
                    'contact' => $row['contact'] ?? null,
                    'last_ip' => $row['last_ip'] ?? null,
                ]),
                'created_at' => $row['created_at'] ?? now(),
                'updated_at' => $row['last_upload_at'] ?? ($row['created_at'] ?? now()),
            ],
            'files' => [
                'id' => $row['id'],
                'uploader_id' => $row['uploader_id'] ?? null,
                'file_name' => $row['filename'] ?? 'legacy-import.xml',
                'payload_type' => $row['entity_type_name'] ?? null,
                'inventory_version' => $row['inventory_version'] ?? null,
                'snapshot_unix' => $row['inventory_unixtime'] ?? null,
                'uploader_swc_uid' => $row['uploaded_by_uid'] ?? null,
                'uploader_handle' => $row['uploaded_by_handle'] ?? null,
                'file_hash' => $row['xml_hash'] ?? null,
                'change_status' => $row['change_status'] ?? 'no_change',
                'new_entities_count' => $row['new_entities_count'] ?? 0,
                'modified_entities_count' => $row['modified_entities_count'] ?? 0,
                'unchanged_entities_count' => $row['unchanged_entities_count'] ?? 0,
                'raw_xml' => null,
                'meta' => $this->encodeMeta([
                    'inventory_timestamp' => $row['inventory_timestamp'] ?? null,
                    'uploaded_at' => $row['uploaded_at'] ?? null,
                    'is_paid' => isset($row['is_paid']) ? (bool) $row['is_paid'] : null,
                    'legacy_entity_type_name' => $row['entity_type_name'] ?? null,
                    'legacy_raw_xml_skipped' => !empty($row['raw_xml']),
                ]),
                'created_at' => $row['uploaded_at'] ?? now(),
                'updated_at' => $row['uploaded_at'] ?? now(),
            ],
            'upload_debug_requests' => [
                'id' => $row['id'],
                'request_id' => $row['request_id'],
                'uploader_id' => $row['uploader_id'] ?? null,
                'swc_uid' => $row['swc_uid'] ?? null,
                'is_guest' => (bool) ($row['is_guest'] ?? false),
                'ip' => $row['ip'] ?? null,
                'user_agent' => $row['user_agent'] ?? null,
                'http_code' => $row['http_code'] ?? null,
                'success_count' => $row['success_count'] ?? 0,
                'error_count' => $row['error_count'] ?? 0,
                'created_at' => $row['created_at'] ?? now(),
            ],
            'upload_debug_events' => [
                'id' => $row['id'],
                'request_id' => $row['request_id'],
                'file_index' => $row['file_index'] ?? null,
                'file_name' => $row['file_name'] ?? null,
                'level' => $row['level'] ?? 'info',
                'event_name' => $row['event_name'],
                'context_json' => $row['context_json'] ?? '{}',
                'created_at' => $row['created_at'] ?? now(),
            ],
            default => $row,
        };
    }

    protected function encodeMeta(array $meta): ?string
    {
        $filtered = array_filter($meta, static fn ($value) => $value !== null && $value !== '');

        if ($filtered === []) {
            return null;
        }

        return json_encode($filtered, JSON_UNESCAPED_SLASHES);
    }

    protected function splitSqlValueGroups(string $values): array
    {
        $groups = [];
        $buffer = '';
        $depth = 0;
        $length = strlen($values);
        $inString = false;
        $stringChar = '';

        for ($index = 0; $index < $length; $index++) {
            $char = $values[$index];
            $prev = $index > 0 ? $values[$index - 1] : '';

            if ($inString) {
                $buffer .= $char;

                if ($char === $stringChar && $prev !== '\\') {
                    $inString = false;
                    $stringChar = '';
                }

                continue;
            }

            if ($char === "'" || $char === '"') {
                $inString = true;
                $stringChar = $char;
                $buffer .= $char;
                continue;
            }

            if ($char === '(') {
                if ($depth > 0) {
                    $buffer .= $char;
                }
                $depth++;
                continue;
            }

            if ($char === ')') {
                $depth--;

                if ($depth > 0) {
                    $buffer .= $char;
                    continue;
                }

                $groups[] = $buffer;
                $buffer = '';
                continue;
            }

            if ($depth > 0) {
                $buffer .= $char;
            }
        }

        return array_values(array_filter(array_map('trim', $groups)));
    }

    protected function normalizeSqlValue(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);

        if (strcasecmp($trimmed, 'NULL') === 0) {
            return null;
        }

        return $trimmed;
    }
}
