<?php

namespace App\Support\DroidBrain;

use App\Models\SwcShipType;
use App\Models\SwcPlanet;
use App\Models\SwcPlanetType;
use App\Models\SwcRace;
use App\Models\SwcStationType;
use App\Models\SwcSystem;
use App\Models\SwcVehicleType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Meilisearch\Client as MeilisearchClient;

class DroidBrainBrowserService
{
    protected array $fullTabs = ['ships', 'stations', 'planets', 'cities', 'vehicles', 'npcs', 'summary'];
    protected array $restrictedTabs = ['ships', 'stations', 'vehicles'];
    protected int $perPageDefault = 50;
    protected int $perPageMax = 100;
    protected int $optionCacheTtlSeconds = 3600;
    protected int $meiliFacetOptionLimit = 500;
    protected array $columnExistsCache = [];
    protected array $meiliFacetRuntimeCache = [];

    public function buildContext(array $query, bool $restricted = false): array
    {
        $tab = $this->normalizeTab((string) ($query['tab'] ?? 'ships'), $restricted);
        $page = max(1, (int) ($query['page'] ?? 1));
        $perPage = min($this->perPageMax, max(1, (int) ($query['per_page'] ?? $this->perPageDefault)));

        $filters = [
            'q' => $restricted ? '' : trim((string) ($query['q'] ?? '')),
            'uid' => trim((string) ($query['uid'] ?? '')),
            'uploader' => '',
            'type' => trim((string) ($query['type'] ?? '')),
            'class' => trim((string) ($query['class'] ?? '')),
            'system' => trim((string) ($query['system'] ?? '')),
            'planet' => trim((string) ($query['planet'] ?? '')),
            'owner' => trim((string) ($query['owner'] ?? '')),
        ];

        if ($restricted) {
            $filters['type'] = '';
            $filters['class'] = '';
            $filters['system'] = '';
            $filters['planet'] = '';
            $filters['owner'] = '';
        }

        $didSearch = $tab === 'summary'
            ? ($filters['owner'] !== '')
            : collect($filters)->contains(fn ($value) => $value !== '');

        $options = $restricted
            ? ['uploader_options' => [], 'type_options' => [], 'class_options' => [], 'system_options' => [], 'planet_options' => [], 'owner_options' => []]
            : Cache::remember(
                'droidbrain_options_' . $tab,
                $this->optionCacheTtlSeconds,
                fn () => [
                    'uploader_options' => [],
                    'type_options'     => $this->getTypeOptions($tab),
                    'class_options'    => $this->getClassOptions($tab),
                    'system_options'   => $this->getSystemOptions($tab),
                    'planet_options'   => $this->getPlanetOptions($tab),
                    'owner_options'    => $this->getOwnerOptions(),
                ]
            );

        $result = $tab === 'summary'
            ? $this->buildSummary($filters['owner'])
            : ($didSearch ? $this->search($tab, $filters, $page, $perPage) : [
                'rows' => [],
                'total' => 0,
            ]);

        return [
            'tab' => $tab,
            'tab_labels' => $this->tabLabels($restricted),
            'filters' => $filters,
            'options' => $options,
            'did_search' => $didSearch,
            'results' => $result['rows'] ?? [],
            'total_rows' => $result['total'] ?? 0,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, (int) ceil(($result['total'] ?? 0) / $perPage)),
            'summary' => $result['summary'] ?? [],
        ];
    }

    public function buildHistory(string $tab, string $entityUid, int $limit = 10, bool $restricted = false): array
    {
        $tab = $this->normalizeTab($tab, $restricted);
        $entityUid = trim($entityUid);
        $limit = min(25, max(1, $limit));

        if ($entityUid === '' || $tab === 'summary') {
            return [];
        }

        $table = match ($tab) {
            'ships' => 'droidbrain_ships',
            'stations' => 'droidbrain_stations',
            'planets' => 'droidbrain_planets',
            'cities' => 'droidbrain_cities',
            'vehicles' => 'droidbrain_vehicles',
            'npcs' => 'droidbrain_npcs',
            default => null,
        };

        if (!$table || !DB::getSchemaBuilder()->hasColumn($table, 'entity_uid')) {
            return [];
        }

        $selects = $this->historySelectColumns($table);

        return DB::table($table)
            ->leftJoin('droidbrain_files', 'droidbrain_files.id', '=', $table . '.file_id')
            ->where($table . '.entity_uid', $entityUid)
            ->orderByDesc($table . '.snapshot_unixtime')
            ->orderByDesc($table . '.id')
            ->limit($limit)
            ->get($selects)
            ->map(fn ($row) => $this->normalizeResultRow($tab, (array) $row))
            ->all();
    }

    protected function historySelectColumns(string $table): array
    {
        $columns = [
            'id',
            'entity_uid',
            'identifier',
            'name',
            'type_name',
            'race_name',
            'class_name',
            'owner_name',
            'government',
            'sector_name',
            'system_name',
            'planet_name',
            'galx',
            'galy',
            'sysx',
            'sysy',
            'snapshot_unixtime',
            'file_id',
        ];

        $selects = [];

        foreach ($columns as $column) {
            if (DB::getSchemaBuilder()->hasColumn($table, $column)) {
                $selects[] = $table . '.' . $column;
            }
        }

        $selects[] = 'droidbrain_files.file_name';
        $selects[] = 'droidbrain_files.change_status as file_change_status';
        $selects[] = 'droidbrain_files.created_at as file_created_at';

        return $selects;
    }

    protected function tabLabels(bool $restricted = false): array
    {
        $labels = [
            'ships' => 'Ships',
            'stations' => 'Stations',
            'planets' => 'Planets',
            'cities' => 'Cities',
            'vehicles' => 'Vehicles',
            'npcs' => 'NPCs',
            'summary' => 'Summary',
        ];

        if (!$restricted) {
            return $labels;
        }

        return array_intersect_key($labels, array_flip($this->restrictedTabs));
    }

    protected function normalizeTab(string $tab, bool $restricted = false): string
    {
        $allowed = array_keys($this->tabLabels($restricted));
        return in_array($tab, $allowed, true) ? $tab : 'ships';
    }

    protected function search(string $tab, array $filters, int $page, int $perPage): array
    {
        // uid-only exact lookup — skip Meilisearch entirely
        $hasUid     = $filters['uid'] !== '';
        $hasQ       = $filters['q'] !== '';
        $hasFilters = $filters['type'] !== '' || $filters['class'] !== ''
            || $filters['system'] !== '' || $filters['planet'] !== ''
            || $filters['owner'] !== '';

        if ($hasUid && !$hasQ && !$hasFilters) {
            return $this->searchByUidOnly($tab, $filters['uid'], $page, $perPage);
        }

        // Meilisearch handles text search + all structured filters + pagination
        $meiliResult = $this->queryMeilisearch($tab, $filters, $page, $perPage);

        if ($meiliResult === null) {
            // Meilisearch unavailable — fall back to DB LIKE
            return $this->searchFallback($tab, $filters, $page, $perPage);
        }

        ['entity_uids' => $entityUids, 'total' => $total] = $meiliResult;

        if ($entityUids === []) {
            return ['rows' => [], 'total' => $total];
        }

        // Fetch full display columns for this page only from the _latest view
        $table = $this->tableForTab($tab);
        $dbQuery = DB::table($table)->whereIn('entity_uid', $entityUids);

        // Apply uid exact filter in DB if also set alongside q/other filters
        if ($hasUid) {
            $uidFilter = $this->normalizeEntityUidFilter($filters['uid']);
            $dbQuery->where(function ($inner) use ($uidFilter) {
                if ($uidFilter['exact'] !== null) {
                    $inner->where('entity_uid', $uidFilter['exact']);
                }
                if ($uidFilter['numeric'] !== null) {
                    $method = $uidFilter['exact'] !== null ? 'orWhere' : 'where';
                    $inner->{$method}('entity_uid', 'like', '%:' . $uidFilter['numeric']);
                }
            });
        }

        // Preserve Meilisearch relevance order within this page
        $rowsByUid = $dbQuery->get()->keyBy('entity_uid');
        $rows = collect($entityUids)
            ->map(fn ($uid) => $rowsByUid->get($uid))
            ->filter()
            ->map(fn ($row) => $this->normalizeResultRow($tab, (array) $row))
            ->values()
            ->all();

        return ['rows' => $rows, 'total' => $total];
    }

    protected function queryMeilisearch(string $tab, array $filters, int $page, int $perPage): ?array
    {
        try {
            $client     = app(MeilisearchClient::class);
            $index      = $client->index($this->indexForTab($tab));
            $filterParts = $this->buildMeilisearchFilter($tab, $filters);

            $options = [
                'attributesToRetrieve' => ['entity_uid'],
                'hitsPerPage'          => $perPage,
                'page'                 => $page,
                'sort'                 => ['name:asc'],
            ];

            if ($filterParts !== []) {
                $options['filter'] = $filterParts;
            }

            $result = $index->search($filters['q'], $options);
            // Scout overrides entity_uid with getScoutKey() (colon→underscore); reverse it
            $entityUids = array_map(
                fn ($uid) => str_replace('_', ':', (string) $uid),
                array_column($result->getHits(), 'entity_uid')
            );
            $total = $result->getTotalHits() ?? $result->getEstimatedTotalHits() ?? 0;

            return ['entity_uids' => $entityUids, 'total' => $total];
        } catch (\Throwable) {
            return null;
        }
    }

    protected function buildMeilisearchFilter(string $tab, array $filters): array
    {
        $parts = [];

        $typeField = match ($tab) {
            'planets' => 'planet_type_name',
            'npcs'    => 'race_name',
            default   => 'type_name',
        };
        $ownerField = $tab === 'planets' ? 'government' : 'owner_name';

        if ($filters['type'] !== '') {
            $parts[] = $typeField . ' = ' . $this->meiliQuote($filters['type']);
        }
        if ($filters['class'] !== '' && in_array($tab, ['ships', 'stations', 'vehicles', 'npcs'], true)) {
            $parts[] = 'class_name = ' . $this->meiliQuote($filters['class']);
        }
        if ($filters['system'] !== '' && in_array($tab, ['ships', 'stations', 'planets'], true)) {
            $parts[] = 'system_name = ' . $this->meiliQuote($filters['system']);
        }
        if ($filters['planet'] !== '' && in_array($tab, ['ships', 'stations', 'cities', 'vehicles', 'npcs'], true)) {
            $parts[] = 'planet_name = ' . $this->meiliQuote($filters['planet']);
        }
        if ($filters['owner'] !== '') {
            $parts[] = $ownerField . ' = ' . $this->meiliQuote($filters['owner']);
        }

        return $parts;
    }

    protected function meiliQuote(string $value): string
    {
        return '"' . str_replace('"', '\\"', $value) . '"';
    }

    protected function indexForTab(string $tab): string
    {
        return match ($tab) {
            'ships'    => 'droidbrain_ships',
            'stations' => 'droidbrain_stations',
            'planets'  => 'droidbrain_planets',
            'cities'   => 'droidbrain_cities',
            'vehicles' => 'droidbrain_vehicles',
            'npcs'     => 'droidbrain_npcs',
            default    => 'droidbrain_ships',
        };
    }

    protected function searchByUidOnly(string $tab, string $uid, int $page, int $perPage): array
    {
        $uidFilter = $this->normalizeEntityUidFilter($uid);
        $table     = $this->tableForTab($tab);
        $query     = DB::table($table)->where(function ($inner) use ($uidFilter) {
            if ($uidFilter['exact'] !== null) {
                $inner->where('entity_uid', $uidFilter['exact']);
            }
            if ($uidFilter['numeric'] !== null) {
                $method = $uidFilter['exact'] !== null ? 'orWhere' : 'where';
                $inner->{$method}('entity_uid', 'like', '%:' . $uidFilter['numeric']);
            }
        });

        $total = (clone $query)->count();
        $rows  = $query->orderBy('name')->forPage($page, $perPage)->get()
            ->map(fn ($row) => $this->normalizeResultRow($tab, (array) $row))->all();

        return ['rows' => $rows, 'total' => $total];
    }

    protected function searchFallback(string $tab, array $filters, int $page, int $perPage): array
    {
        $table = $this->tableForTab($tab);
        $query = DB::table($table);

        if ($filters['q'] !== '') {
            $query->where('name', 'like', '%' . $filters['q'] . '%');
        }

        if ($filters['uid'] !== '') {
            $uidFilter = $this->normalizeEntityUidFilter($filters['uid']);
            $query->where(function ($inner) use ($uidFilter) {
                if ($uidFilter['exact'] !== null) {
                    $inner->where('entity_uid', $uidFilter['exact']);
                }
                if ($uidFilter['numeric'] !== null) {
                    $method = $uidFilter['exact'] !== null ? 'orWhere' : 'where';
                    $inner->{$method}('entity_uid', 'like', '%:' . $uidFilter['numeric']);
                }
            });
        }

        $this->applyTabSpecificFilters($query, $tab, $filters);

        $total = (clone $query)->count();
        $rows  = $query->orderBy('name')->forPage($page, $perPage)->get()
            ->map(fn ($row) => $this->normalizeResultRow($tab, (array) $row))->all();

        return ['rows' => $rows, 'total' => $total];
    }

    protected function normalizeEntityUidFilter(string $value): array
    {
        $value = trim($value);

        if ($value === '') {
            return [
                'exact' => null,
                'numeric' => null,
            ];
        }

        if (preg_match('/^\d+:\d+$/', $value) === 1) {
            return [
                'exact' => $value,
                'numeric' => preg_replace('/^\d+:/', '', $value),
            ];
        }

        if (preg_match('/^\d+$/', $value) === 1) {
            return [
                'exact' => null,
                'numeric' => $value,
            ];
        }

        return [
            'exact' => $value,
            'numeric' => null,
        ];
    }

    protected function applyTabSpecificFilters($query, string $tab, array $filters): void
    {
        if (in_array($tab, ['ships', 'stations', 'vehicles', 'npcs'], true) && $filters['type'] !== '') {
            $this->applyNormalizedTypeFilter($query, $tab, $filters['type']);
        }

        if ($tab === 'ships' && $filters['class'] !== '') {
            $matchingShipTypes = SwcShipType::query()
                ->whereNotNull('class_name')
                ->where('class_name', '!=', '')
                ->where('class_name', 'like', '%' . $filters['class'] . '%')
                ->pluck('name')
                ->filter(fn ($value) => trim((string) $value) !== '')
                ->values()
                ->all();

            $query->where(function ($inner) use ($filters, $matchingShipTypes) {
                if ($matchingShipTypes !== [] && $this->tableHasColumn('ships', 'type_name')) {
                    $inner->whereIn('type_name', $matchingShipTypes);
                }

                if ($this->tableHasColumn('ships', 'class_name')) {
                    $method = $matchingShipTypes !== [] ? 'orWhere' : 'where';
                    $inner->{$method}('class_name', 'like', '%' . $filters['class'] . '%');
                }
            });
        }

        if ($tab === 'vehicles' && $filters['class'] !== '') {
            $matchingVehicleTypes = SwcVehicleType::query()
                ->whereNotNull('class_name')
                ->where('class_name', '!=', '')
                ->where('class_name', 'like', '%' . $filters['class'] . '%')
                ->pluck('name')
                ->filter(fn ($value) => trim((string) $value) !== '')
                ->values()
                ->all();

            $query->where(function ($inner) use ($filters, $matchingVehicleTypes) {
                if ($matchingVehicleTypes !== [] && $this->tableHasColumn('vehicles', 'type_name')) {
                    $inner->whereIn('type_name', $matchingVehicleTypes);
                }

                if ($this->tableHasColumn('vehicles', 'class_name')) {
                    $method = $matchingVehicleTypes !== [] ? 'orWhere' : 'where';
                    $inner->{$method}('class_name', 'like', '%' . $filters['class'] . '%');
                }
            });
        }

        if ($tab === 'npcs' && $filters['class'] !== '' && $this->tableHasColumn($tab, 'class_name')) {
            $query->where('class_name', 'like', '%' . $filters['class'] . '%');
        }

        if (in_array($tab, ['ships', 'stations', 'planets'], true) && $filters['system'] !== '' && $this->tableHasColumn($tab, 'system_name')) {
            $query->where('system_name', 'like', '%' . $filters['system'] . '%');
        }

        if (in_array($tab, ['ships', 'stations', 'cities', 'vehicles', 'npcs'], true) && $filters['planet'] !== '' && $this->tableHasColumn($tab, 'planet_name')) {
            $query->where('planet_name', 'like', '%' . $filters['planet'] . '%');
        }

        if ($filters['owner'] !== '') {
            $ownerColumn = $tab === 'planets' ? 'government' : 'owner_name';
            if ($this->tableHasColumn($tab, $ownerColumn)) {
                $query->where($ownerColumn, $filters['owner']);
            }
        }
    }

    protected function buildSummary(string $owner): array
    {
        $summary = [];

        foreach (['ships', 'stations', 'planets', 'cities', 'vehicles', 'npcs'] as $tab) {
            $table = $this->tableForTab($tab);
            $ownerColumn = $tab === 'planets' ? 'government' : 'owner_name';
            $typeColumn = match ($tab) {
                'npcs' => 'race_name',
                'planets' => 'planet_type_name',
                'cities' => null,
                default => 'type_name',
            };
            $classColumn = in_array($tab, ['ships', 'vehicles', 'npcs'], true) ? 'class_name' : null;

            $query = DB::table($table);
            if ($owner !== '' && $this->tableHasColumn($tab, $ownerColumn)) {
                $query->where($ownerColumn, $owner);
            }

            $rows = $query
                ->selectRaw(
                    trim(implode(', ', array_filter([
                        $ownerColumn . ' as owner_name',
                        $typeColumn ? $typeColumn . ' as type_name' : "'" . ucfirst($tab) . "' as type_name",
                        $classColumn ? $classColumn . ' as class_name' : "null as class_name",
                        'count(*) as total',
                    ])))
                )
                ->groupBy(array_filter([$ownerColumn, $typeColumn, $classColumn]))
                ->orderBy('owner_name')
                ->orderBy('type_name')
                ->orderBy('class_name')
                ->get()
                ->map(fn ($row) => $this->normalizeResultRow($tab, (array) $row))
                ->all();

            $summary[$tab] = $rows;
        }

        return [
            'rows' => [],
            'total' => 0,
            'summary' => $summary,
        ];
    }

    protected function getTypeOptions(string $tab): array
    {
        if ($tab === 'ships') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcShipType(), 'name'),
                $this->getDistinctOptions($tab, 'type_name')
            );
        }

        if ($tab === 'stations') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcStationType(), 'name'),
                $this->getDistinctOptions($tab, 'type_name')
            );
        }

        if ($tab === 'vehicles') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcVehicleType(), 'name'),
                $this->getDistinctOptions($tab, 'type_name'),
                $this->getTableColumnOptions('droidbrain_vehicles', 'type_name')
            );
        }

        $column = match ($tab) {
            'npcs' => 'race_name',
            'planets' => 'planet_type_name',
            default => null,
        };

        if ($tab === 'npcs') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcRace(), 'name'),
                $this->getDistinctOptions($tab, 'race_name')
            );
        }

        if ($tab === 'planets') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcPlanetType(), 'name'),
                $this->getDistinctOptions($tab, 'planet_type_name')
            );
        }

        return $column ? $this->getDistinctOptions($tab, $column) : [];
    }

    protected function getClassOptions(string $tab): array
    {
        if ($tab === 'ships') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcShipType(), 'class_name'),
                $this->getDistinctOptions($tab, 'class_name'),
                $this->getTableColumnOptions('droidbrain_ships', 'class_name')
            );
        }

        if ($tab === 'vehicles') {
            return $this->mergeOptions(
                $this->getModelColumnOptions(new SwcVehicleType(), 'class_name'),
                $this->getDistinctOptions($tab, 'class_name'),
                $this->getTableColumnOptions('droidbrain_vehicles', 'class_name')
            );
        }

        return in_array($tab, ['ships', 'vehicles', 'npcs'], true)
            ? $this->getDistinctOptions($tab, 'class_name')
            : [];
    }

    protected function mergeOptions(array ...$groups): array
    {
        return collect($groups)
            ->flatten()
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    protected function normalizeResultRow(string $tab, array $row): array
    {
        if (
            $tab === 'stations'
            && (int) ($row['type_id'] ?? 0) > 0
            && trim((string) ($row['type_name'] ?? '')) === ''
        ) {
            $resolvedType = SwcStationType::query()->whereKey($row['type_id'])->value('name');

            if (is_string($resolvedType) && trim($resolvedType) !== '') {
                $row['type_name'] = $resolvedType;
            }
        }

        if (
            $tab === 'ships'
            && trim((string) ($row['type_name'] ?? '')) !== ''
            && trim((string) ($row['class_name'] ?? '')) === ''
        ) {
            $resolvedClass = SwcShipType::query()
                ->where('name', $row['type_name'])
                ->value('class_name');

            if (is_string($resolvedClass) && trim($resolvedClass) !== '') {
                $row['class_name'] = $resolvedClass;
            }
        }

        if (
            $tab === 'ships'
            && (int) ($row['type_id'] ?? 0) > 0
            && trim((string) ($row['type_name'] ?? '')) === ''
        ) {
            $resolvedType = SwcShipType::query()->whereKey($row['type_id'])->value('name');

            if (is_string($resolvedType) && trim($resolvedType) !== '') {
                $row['type_name'] = $resolvedType;
            }
        }

        if (
            $tab === 'vehicles'
            && trim((string) ($row['type_name'] ?? '')) !== ''
            && trim((string) ($row['class_name'] ?? '')) === ''
        ) {
            $resolvedClass = SwcVehicleType::query()
                ->where('name', $row['type_name'])
                ->value('class_name');

            if (is_string($resolvedClass) && trim($resolvedClass) !== '') {
                $row['class_name'] = $resolvedClass;
            }
        }

        if (
            $tab === 'vehicles'
            && (int) ($row['type_id'] ?? 0) > 0
            && trim((string) ($row['type_name'] ?? '')) === ''
        ) {
            $resolvedType = SwcVehicleType::query()->whereKey($row['type_id'])->value('name');

            if (is_string($resolvedType) && trim($resolvedType) !== '') {
                $row['type_name'] = $resolvedType;
            }
        }

        if (
            $tab === 'planets'
            && (int) ($row['type_id'] ?? 0) > 0
            && trim((string) ($row['type_name'] ?? $row['planet_type_name'] ?? '')) === ''
        ) {
            $resolvedType = SwcPlanetType::query()->whereKey($row['type_id'])->value('name');

            if (is_string($resolvedType) && trim($resolvedType) !== '') {
                $row['planet_type_name'] = $resolvedType;
                $row['type_name'] = $resolvedType;
            }
        }

        if (
            $tab === 'npcs'
            && (int) ($row['race_id'] ?? 0) > 0
            && trim((string) ($row['race_name'] ?? '')) === ''
        ) {
            $resolvedRace = SwcRace::query()->whereKey($row['race_id'])->value('name');

            if (is_string($resolvedRace) && trim($resolvedRace) !== '') {
                $row['race_name'] = $resolvedRace;
            }
        }

        return $row;
    }

    protected function applyNormalizedTypeFilter($query, string $tab, string $needle): void
    {
        if ($tab === 'ships') {
            $matchingIds = SwcShipType::query()
                ->where('name', 'like', '%' . $needle . '%')
                ->pluck('id')
                ->all();

            $query->where(function ($inner) use ($needle, $matchingIds) {
                if ($this->tableHasColumn('ships', 'type_name')) {
                    $inner->where('type_name', 'like', '%' . $needle . '%');
                }

                if ($matchingIds !== [] && $this->tableHasColumn('ships', 'type_id')) {
                    $method = $this->tableHasColumn('ships', 'type_name') ? 'orWhereIn' : 'whereIn';
                    $inner->{$method}('type_id', $matchingIds);
                }
            });

            return;
        }

        if ($tab === 'stations') {
            $matchingIds = SwcStationType::query()
                ->where('name', 'like', '%' . $needle . '%')
                ->pluck('id')
                ->all();

            $query->where(function ($inner) use ($needle, $matchingIds) {
                if ($this->tableHasColumn('stations', 'type_name')) {
                    $inner->where('type_name', 'like', '%' . $needle . '%');
                }

                if ($matchingIds !== [] && $this->tableHasColumn('stations', 'type_id')) {
                    $method = $this->tableHasColumn('stations', 'type_name') ? 'orWhereIn' : 'whereIn';
                    $inner->{$method}('type_id', $matchingIds);
                }
            });

            return;
        }

        if ($tab === 'vehicles') {
            $matchingIds = SwcVehicleType::query()
                ->where('name', 'like', '%' . $needle . '%')
                ->pluck('id')
                ->all();

            $query->where(function ($inner) use ($needle, $matchingIds) {
                if ($this->tableHasColumn('vehicles', 'type_name')) {
                    $inner->where('type_name', 'like', '%' . $needle . '%');
                }

                if ($matchingIds !== [] && $this->tableHasColumn('vehicles', 'type_id')) {
                    $method = $this->tableHasColumn('vehicles', 'type_name') ? 'orWhereIn' : 'whereIn';
                    $inner->{$method}('type_id', $matchingIds);
                }
            });

            return;
        }

        if ($tab === 'planets') {
            $matchingIds = SwcPlanetType::query()
                ->where('name', 'like', '%' . $needle . '%')
                ->pluck('id')
                ->all();

            $query->where(function ($inner) use ($needle, $matchingIds) {
                if ($this->tableHasColumn('planets', 'planet_type_name')) {
                    $inner->where('planet_type_name', 'like', '%' . $needle . '%');
                }

                if ($matchingIds !== [] && $this->tableHasColumn('planets', 'type_id')) {
                    $method = $this->tableHasColumn('planets', 'planet_type_name') ? 'orWhereIn' : 'whereIn';
                    $inner->{$method}('type_id', $matchingIds);
                }
            });

            return;
        }

        if ($tab === 'npcs') {
            $matchingIds = SwcRace::query()
                ->where('name', 'like', '%' . $needle . '%')
                ->pluck('id')
                ->all();

            $query->where(function ($inner) use ($needle, $matchingIds) {
                if ($this->tableHasColumn('npcs', 'race_name')) {
                    $inner->where('race_name', 'like', '%' . $needle . '%');
                }

                if ($matchingIds !== [] && $this->tableHasColumn('npcs', 'race_id')) {
                    $method = $this->tableHasColumn('npcs', 'race_name') ? 'orWhereIn' : 'whereIn';
                    $inner->{$method}('race_id', $matchingIds);
                }
            });
        }
    }

    protected function getModelColumnOptions(Model $model, string $column): array
    {
        return $this->getTableColumnOptions($model->getTable(), $column);
    }

    protected function getTableColumnOptions(string $table, string $column): array
    {
        if (!DB::getSchemaBuilder()->hasColumn($table, $column)) {
            return [];
        }

        return DB::table($table)
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->limit(500)
            ->pluck($column)
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();
    }

    protected function getSystemOptions(string $tab): array
    {
        return in_array($tab, ['ships', 'stations', 'planets'], true)
            ? $this->mergeOptions(
                $this->getModelColumnOptions(new SwcSystem(), 'name'),
                $this->getDistinctOptions('ships', 'system_name'),
                $this->getDistinctOptions('stations', 'system_name'),
                $this->getDistinctOptions('planets', 'system_name')
            )
            : [];
    }

    protected function getPlanetOptions(string $tab): array
    {
        return in_array($tab, ['ships', 'stations', 'cities', 'vehicles', 'npcs'], true)
            ? $this->mergeOptions(
                $this->getModelColumnOptions(new SwcPlanet(), 'name'),
                $this->getDistinctOptions('ships', 'planet_name'),
                $this->getDistinctOptions('stations', 'planet_name'),
                $this->getDistinctOptions('cities', 'planet_name'),
                $this->getDistinctOptions('vehicles', 'planet_name'),
                $this->getDistinctOptions('npcs', 'planet_name')
            )
            : [];
    }

    protected function getOwnerOptions(): array
    {
        $owners = collect();

        foreach (['ships', 'stations', 'cities', 'vehicles', 'npcs'] as $tab) {
            $owners = $owners->merge($this->getDistinctOptions($tab, 'owner_name'));
        }

        $owners = $owners->merge($this->getDistinctOptions('planets', 'government'));

        return $owners
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function warmOptionsCache(string $tab): void
    {
        $key = 'droidbrain_options_' . $tab;
        Cache::forget($key);
        Cache::remember($key, $this->optionCacheTtlSeconds, fn () => [
            'uploader_options' => [],
            'type_options'     => $this->getTypeOptions($tab),
            'class_options'    => $this->getClassOptions($tab),
            'system_options'   => $this->getSystemOptions($tab),
            'planet_options'   => $this->getPlanetOptions($tab),
            'owner_options'    => $this->getOwnerOptions(),
        ]);
    }

    protected function getDistinctOptions(string $tab, string $column): array
    {
        $meiliValues = $this->getDistinctOptionsFromMeilisearch($tab, $column);
        if ($meiliValues !== null) {
            return $meiliValues;
        }

        if (!$this->tableHasColumn($tab, $column)) {
            return [];
        }

        return DB::table($this->tableForTab($tab))
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->limit(500)
            ->pluck($column)
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();
    }

    protected function getDistinctOptionsFromMeilisearch(string $tab, string $column): ?array
    {
        $index = $this->indexForTab($tab);
        $cacheKey = $index . ':' . $column;

        if (array_key_exists($cacheKey, $this->meiliFacetRuntimeCache)) {
            $cached = $this->meiliFacetRuntimeCache[$cacheKey];
            return is_array($cached) ? $cached : null;
        }

        try {
            $client = app(MeilisearchClient::class);
            $result = $client->index($index)->search('', [
                'hitsPerPage' => 0,
                'page' => 1,
                'facets' => [$column],
            ]);

            $distribution = $result->getFacetDistribution();
            $facetValues = $distribution[$column] ?? [];

            if (!is_array($facetValues)) {
                $this->meiliFacetRuntimeCache[$cacheKey] = [];
                return [];
            }

            $values = collect(array_keys($facetValues))
                ->map(fn ($value) => trim((string) $value))
                ->filter(fn ($value) => $value !== '')
                ->unique()
                ->sort()
                ->take($this->meiliFacetOptionLimit)
                ->values()
                ->all();

            $this->meiliFacetRuntimeCache[$cacheKey] = $values;
            return $values;
        } catch (\Throwable) {
            // Fall back to DB distinct queries when Meilisearch is unavailable
            $this->meiliFacetRuntimeCache[$cacheKey] = null;
            return null;
        }
    }

    protected function tableForTab(string $tab): string
    {
        return match ($tab) {
            'ships' => 'droidbrain_ships_latest',
            'stations' => 'droidbrain_stations_latest',
            'planets' => 'droidbrain_planets_latest',
            'cities' => 'droidbrain_cities_latest',
            'vehicles' => 'droidbrain_vehicles_latest',
            'npcs' => 'droidbrain_npcs_latest',
            default => 'droidbrain_ships_latest',
        };
    }

    protected function tableHasColumn(string $tab, string $column): bool
    {
        $table = $this->tableForTab($tab);
        $cacheKey = $table . ':' . $column;

        if (array_key_exists($cacheKey, $this->columnExistsCache)) {
            return (bool) $this->columnExistsCache[$cacheKey];
        }

        $exists = DB::getSchemaBuilder()->hasColumn($table, $column);
        $this->columnExistsCache[$cacheKey] = $exists;

        return $exists;
    }
}
