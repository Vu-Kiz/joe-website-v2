<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\Swc\SwcFacilityType;
use App\Models\Swc\SwcCreatureType;
use App\Models\Swc\SwcDroidType;
use App\Models\HyperPlan;
use App\Models\Swc\SwcHyperlane;
use App\Models\Swc\SwcItemType;
use App\Models\Swc\SwcMaterialType;
use App\Models\Swc\SwcNpcType;
use App\Models\Swc\SwcPlanet;
use App\Models\Swc\SwcPlanetType;
use App\Models\Swc\SwcRace;
use App\Models\Swc\SwcSector;
use App\Models\Swc\SwcSectorCellAnnotation;
use App\Models\Swc\SwcSectorSearchRecord;
use App\Models\User;
use App\Models\Swc\SwcShipType;
use App\Models\Swc\SwcStation;
use App\Models\Swc\SwcStationType;
use App\Models\Swc\SwcTerrainType;
use App\Models\Swc\SwcSystem;
use App\Models\Swc\SwcVehicleType;
use App\Models\Swc\SwcWeaponType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Swc\Auth\Permissions;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class UniverseController extends Controller
{
    public function __construct(protected ToolAccessService $toolAccessService)
    {
    }

    private const SEARCH_RECORDS_CACHE_TTL_SECONDS = 120;
    private const SEARCH_RECORDS_CACHE_VERSION_KEY = 'universe:search-records:version';
    private const CELL_ANNOTATIONS_CACHE_VERSION_KEY = 'universe:cell-annotations:version';

    public function archivePlanets(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));

        return $this->cachedListResponse(
            sprintf('universe:archive:planets:%s', md5(strtolower($query))),
            300,
            function () use ($query) {
                $planets = SwcPlanet::query()
                    ->when($query !== '', function ($builder) use ($query) {
                        $builder->where(function ($inner) use ($query) {
                            $inner
                                ->where('name', 'like', '%' . $query . '%')
                                ->orWhere('uid', $query)
                                ->orWhere('identifier', $query)
                                ->orWhere('system_name', 'like', '%' . $query . '%')
                                ->orWhere('sector_name', 'like', '%' . $query . '%')
                                ->orWhere('owner_name', 'like', '%' . $query . '%')
                                ->orWhere('planet_type_name', 'like', '%' . $query . '%');
                        });
                    })
                    ->orderBy('name')
                    ->limit(500)
                    ->get([
                        'uid',
                        'identifier',
                        'name',
                        'sector_uid',
                        'sector_name',
                        'system_uid',
                        'system_name',
                        'owner_uid',
                        'owner_name',
                        'planet_type_uid',
                        'planet_type_name',
                        'size',
                        'population',
                        'previous_population',
                        'previous_population_recorded_at',
                        'galx',
                        'galy',
                        'sysx',
                        'sysy',
                        'image_small_url',
                        'image_large_url',
                        'last_pulled_at',
                    ]);

                return $planets->map(fn (SwcPlanet $planet) => [
                    'uid' => $planet->uid,
                    'identifier' => $planet->identifier,
                    'name' => $planet->name,
                    'sector_uid' => $planet->sector_uid,
                    'sector_name' => $planet->sector_name,
                    'system_uid' => $planet->system_uid,
                    'system_name' => $planet->system_name,
                    'owner_uid' => $planet->owner_uid,
                    'owner_name' => $planet->owner_name,
                    'planet_type_uid' => $planet->planet_type_uid,
                    'planet_type_name' => $planet->planet_type_name,
                    'size' => $planet->size,
                    'population' => $planet->population,
                    'previous_population' => $planet->previous_population,
                    'previous_population_recorded_at' => $planet->previous_population_recorded_at,
                    'galx' => $planet->galx,
                    'galy' => $planet->galy,
                    'sysx' => $planet->sysx,
                    'sysy' => $planet->sysy,
                    'image_small_url' => $planet->image_small_url,
                    'image_large_url' => $planet->image_large_url,
                    'last_pulled_at' => $planet->last_pulled_at,
                ])->values()->all();
            }
        );
    }

    public function archivePlanet(Request $request, string $planet): JsonResponse
    {
        $planetRecord = SwcPlanet::query()
            ->where('uid', $planet)
            ->orWhere('identifier', $planet)
            ->orWhere('name', $planet)
            ->firstOrFail();

        return response()->json([
            'ok' => true,
            'data' => [
                'uid' => $planetRecord->uid,
                'identifier' => $planetRecord->identifier,
                'name' => $planetRecord->name,
                'sector_uid' => $planetRecord->sector_uid,
                'sector_name' => $planetRecord->sector_name,
                'system_uid' => $planetRecord->system_uid,
                'system_name' => $planetRecord->system_name,
                'owner_uid' => $planetRecord->owner_uid,
                'owner_name' => $planetRecord->owner_name,
                'planet_type_uid' => $planetRecord->planet_type_uid,
                'planet_type_name' => $planetRecord->planet_type_name,
                'planet_type_href' => $planetRecord->planet_type_href,
                'size' => $planetRecord->size,
                'population' => $planetRecord->population,
                'previous_population' => $planetRecord->previous_population,
                'previous_population_recorded_at' => $planetRecord->previous_population_recorded_at,
                'galx' => $planetRecord->galx,
                'galy' => $planetRecord->galy,
                'sysx' => $planetRecord->sysx,
                'sysy' => $planetRecord->sysy,
                'terrain_map' => $planetRecord->terrain_map,
                'surface_bounds' => $planetRecord->surface_bounds,
                'terrain_grid' => $planetRecord->terrain_grid,
                'cities' => $planetRecord->cities,
                'image_small_url' => $planetRecord->image_small_url,
                'image_large_url' => $planetRecord->image_large_url,
                'image_atmosphere_url' => $planetRecord->image_atmosphere_url,
                'image_stratosphere_url' => $planetRecord->image_stratosphere_url,
                'image_loworbit_url' => $planetRecord->image_loworbit_url,
                'last_pulled_at' => $planetRecord->last_pulled_at,
            ],
        ]);
    }

    public function archiveFactions(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        return $this->cachedListResponse(
            sprintf('universe:archive:factions:%s', md5(strtolower($query))),
            300,
            function () use ($query) {
        $systemsOwned = SwcSystem::query()
            ->whereNotNull('owner_uid')
            ->where('owner_uid', '!=', '')
            ->whereNotNull('owner_name')
            ->where('owner_name', '!=', '')
            ->selectRaw('owner_uid, owner_name, COUNT(*) as total')
            ->groupBy('owner_uid', 'owner_name')
            ->get();

        $planetsOwned = SwcPlanet::query()
            ->whereNotNull('owner_uid')
            ->where('owner_uid', '!=', '')
            ->whereNotNull('owner_name')
            ->where('owner_name', '!=', '')
            ->selectRaw('owner_uid, owner_name, COUNT(*) as total')
            ->groupBy('owner_uid', 'owner_name')
            ->get();

        $populationOwned = SwcPlanet::query()
            ->whereNotNull('owner_uid')
            ->where('owner_uid', '!=', '')
            ->whereNotNull('owner_name')
            ->where('owner_name', '!=', '')
            ->selectRaw('owner_uid, owner_name, COALESCE(SUM(population), 0) as total_population')
            ->groupBy('owner_uid', 'owner_name')
            ->get();

        $populationChangeOwned = SwcPlanet::query()
            ->whereNotNull('owner_uid')
            ->where('owner_uid', '!=', '')
            ->whereNotNull('owner_name')
            ->where('owner_name', '!=', '')
            ->selectRaw('owner_uid, owner_name, COALESCE(SUM(CASE WHEN previous_population IS NOT NULL THEN CAST(population AS SIGNED) - CAST(previous_population AS SIGNED) ELSE 0 END), 0) as total_population_change, SUM(CASE WHEN previous_population IS NOT NULL THEN 1 ELSE 0 END) as tracked_planets')
            ->groupBy('owner_uid', 'owner_name')
            ->get();

        $stationsOwned = SwcStation::query()
            ->whereNotNull('owner_uid')
            ->where('owner_uid', '!=', '')
            ->whereNotNull('owner_name')
            ->where('owner_name', '!=', '')
            ->selectRaw('owner_uid, owner_name, COUNT(*) as total')
            ->groupBy('owner_uid', 'owner_name')
            ->get();

        $factions = collect();

        foreach ($systemsOwned as $row) {
            $key = trim((string) $row->owner_uid);
            if (!str_starts_with($key, '20:')) {
                continue;
            }
            $factions[$key] = array_merge($factions[$key] ?? [
                'id' => null,
                'name' => trim((string) $row->owner_name),
                'abbreviation' => null,
                'owner_uid' => $key,
                'swc_uid' => $this->extractFactionSwcUid($key),
                'member_count' => null,
                'systems_owned' => 0,
                'planets_owned' => 0,
                'stations_owned' => 0,
                'population' => null,
                'population_change' => null,
            ], [
                'systems_owned' => (int) $row->total,
            ]);
        }

        foreach ($planetsOwned as $row) {
            $key = trim((string) $row->owner_uid);
            if (!str_starts_with($key, '20:')) {
                continue;
            }
            $factions[$key] = array_merge($factions[$key] ?? [
                'id' => null,
                'name' => trim((string) $row->owner_name),
                'abbreviation' => null,
                'owner_uid' => $key,
                'swc_uid' => $this->extractFactionSwcUid($key),
                'member_count' => null,
                'systems_owned' => 0,
                'planets_owned' => 0,
                'stations_owned' => 0,
                'population' => null,
                'population_change' => null,
            ], [
                'planets_owned' => (int) $row->total,
            ]);
        }

        foreach ($stationsOwned as $row) {
            $key = trim((string) $row->owner_uid);
            if (!str_starts_with($key, '20:')) {
                continue;
            }
            $factions[$key] = array_merge($factions[$key] ?? [
                'id' => null,
                'name' => trim((string) $row->owner_name),
                'abbreviation' => null,
                'owner_uid' => $key,
                'swc_uid' => $this->extractFactionSwcUid($key),
                'member_count' => null,
                'systems_owned' => 0,
                'planets_owned' => 0,
                'stations_owned' => 0,
                'population' => null,
                'population_change' => null,
            ], [
                'stations_owned' => (int) $row->total,
            ]);
        }

        foreach ($populationOwned as $row) {
            $key = trim((string) $row->owner_uid);
            if (!str_starts_with($key, '20:')) {
                continue;
            }
            $factions[$key] = array_merge($factions[$key] ?? [
                'id' => null,
                'name' => trim((string) $row->owner_name),
                'abbreviation' => null,
                'owner_uid' => $key,
                'swc_uid' => $this->extractFactionSwcUid($key),
                'member_count' => null,
                'systems_owned' => 0,
                'planets_owned' => 0,
                'stations_owned' => 0,
                'population' => null,
                'population_change' => null,
            ], [
                'population' => $row->total_population !== null ? (int) $row->total_population : null,
            ]);
        }

        foreach ($populationChangeOwned as $row) {
            $key = trim((string) $row->owner_uid);
            if (!str_starts_with($key, '20:')) {
                continue;
            }
            $factions[$key] = array_merge($factions[$key] ?? [
                'id' => null,
                'name' => trim((string) $row->owner_name),
                'abbreviation' => null,
                'owner_uid' => $key,
                'swc_uid' => $this->extractFactionSwcUid($key),
                'member_count' => null,
                'systems_owned' => 0,
                'planets_owned' => 0,
                'stations_owned' => 0,
                'population' => null,
                'population_change' => null,
            ], [
                'population_change' => (int) ($row->tracked_planets ?? 0) > 0
                    ? (int) $row->total_population_change
                    : null,
            ]);
        }

        $localFactions = Faction::query()->get();

        foreach ($localFactions as $faction) {
            $ownerUid = $faction->swc_uid ? ('20:' . $faction->swc_uid) : null;
            if (!$ownerUid) {
                continue;
            }

            if (!isset($factions[$ownerUid])) {
                continue;
            }

            $existing = $factions[$ownerUid];

            $existing['id'] = $faction->id;
            $existing['name'] = $existing['name'] ?: $faction->name;
            $existing['abbreviation'] = $faction->abbreviation;
            $existing['member_count'] = $faction->users()->count();

            $factions[$ownerUid] = $existing;
        }

        $results = collect($factions)
            ->values()
            ->filter(function (array $faction) {
                return (int) ($faction['planets_owned'] ?? 0) > 0;
            })
            ->filter(function (array $faction) use ($query) {
                if ($query === '') {
                    return true;
                }

                $haystack = implode(' ', array_filter([
                    $faction['name'] ?? null,
                    $faction['abbreviation'] ?? null,
                    $faction['owner_uid'] ?? null,
                    isset($faction['swc_uid']) ? (string) $faction['swc_uid'] : null,
                ]));

                return str_contains(strtolower($haystack), strtolower($query));
            })
            ->sortBy(fn (array $faction) => strtolower((string) ($faction['name'] ?? '')))
            ->values()
            ->all();

                return $results;
            }
        );
    }

    private function cachedListResponse(string $cacheKey, int $seconds, callable $resolver): JsonResponse
    {
        $data = Cache::remember($cacheKey, $seconds, $resolver);

        return response()->json([
            'ok' => true,
            'data' => $data,
        ]);
    }

    private function extractFactionSwcUid(?string $ownerUid): ?int
    {
        $ownerUid = trim((string) $ownerUid);

        if (preg_match('/^20:(\d+)$/', $ownerUid, $matches) === 1) {
            return (int) $matches[1];
        }

        return null;
    }

    private function normalizeSectorCoordinates(array $coordinates): array
    {
        return collect($coordinates)
            ->filter(fn ($coordinate) => is_array($coordinate))
            ->map(function (array $coordinate) {
                $galx = isset($coordinate['galx']) && is_numeric($coordinate['galx'])
                    ? (int) $coordinate['galx']
                    : null;
                $galy = isset($coordinate['galy']) && is_numeric($coordinate['galy'])
                    ? (int) $coordinate['galy']
                    : null;

                if ($galx === null || $galy === null) {
                    return null;
                }

                return [
                    'galx' => $galx,
                    'galy' => $galy,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function pointInPolygon(float $x, float $y, array $polygon): bool
    {
        $inside = false;
        $count = count($polygon);

        if ($count < 3) {
            return false;
        }

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $xi = $polygon[$i]['galx'];
            $yi = $polygon[$i]['galy'];
            $xj = $polygon[$j]['galx'];
            $yj = $polygon[$j]['galy'];

            $intersects = (($yi > $y) !== ($yj > $y))
                && ($x < (($xj - $xi) * ($y - $yi)) / (($yj - $yi) ?: 1e-9) + $xi);

            if ($intersects) {
                $inside = !$inside;
            }
        }

        return $inside;
    }

    private function cellOverlapsPolygon(int $galx, int $galy, array $polygon): bool
    {
        $samples = [
            [$galx + 0.5, $galy + 0.5],
            [$galx + 0.15, $galy + 0.15],
            [$galx + 0.85, $galy + 0.15],
            [$galx + 0.15, $galy + 0.85],
            [$galx + 0.85, $galy + 0.85],
        ];

        foreach ($samples as [$sampleX, $sampleY]) {
            if ($this->pointInPolygon($sampleX, $sampleY, $polygon)) {
                return true;
            }
        }

        return false;
    }

    private function buildSectorCellKeys(array $polygon, ?array $bounds): array
    {
        $areaKeys = [];

        if (
            $bounds &&
            isset($bounds['min_galx'], $bounds['max_galx'], $bounds['min_galy'], $bounds['max_galy']) &&
            is_numeric($bounds['min_galx']) &&
            is_numeric($bounds['max_galx']) &&
            is_numeric($bounds['min_galy']) &&
            is_numeric($bounds['max_galy'])
        ) {
            for ($galx = (int) $bounds['min_galx']; $galx <= (int) $bounds['max_galx']; $galx += 1) {
                for ($galy = (int) $bounds['min_galy']; $galy <= (int) $bounds['max_galy']; $galy += 1) {
                    if ($this->cellOverlapsPolygon($galx, $galy, $polygon)) {
                        $areaKeys[sprintf('%d:%d', $galx, $galy)] = true;
                    }
                }
            }
        }

        foreach ($polygon as $point) {
            $areaKeys[sprintf('%d:%d', $point['galx'], $point['galy'])] = true;
        }

        return $areaKeys;
    }

    private function sectorCellCoordinatesFromKeys(array $keys): array
    {
        return collect(array_keys($keys))
            ->map(function (string $key) {
                [$galx, $galy] = array_map('intval', explode(':', $key, 2));

                return [
                    'galx' => $galx,
                    'galy' => $galy,
                ];
            })
            ->sortBy([
                ['galy', 'asc'],
                ['galx', 'asc'],
            ])
            ->values()
            ->all();
    }

    protected function canViewAsteroidIntel(Request $request): bool
    {
        return Permissions::hasAny(
            $request->user(),
            ['can_view_asteroid_intel', 'is_admin', 'is_sysadmin']
        );
    }

    /**
     * Returns the user's ID if they are a JOE member without full intel access,
     * so the map shows only records they personally imported. Returns null otherwise.
     */
    protected function resolveJoeMemberId(Request $request): ?int
    {
        $user = $request->user();
        if (!$user || !$user->is_joe_member) {
            return null;
        }
        if ($this->canViewAsteroidIntel($request)) {
            return null; // full intel — no restriction needed
        }
        return $user->id;
    }

    protected function resolveScanWindow(Request $request): ?array
    {
        $user = $request->user();
        if (!$user) {
            return null;
        }

        $coords = [
            $user->scan_window_top_left_galx,
            $user->scan_window_top_left_galy,
            $user->scan_window_bottom_right_galx,
            $user->scan_window_bottom_right_galy,
        ];

        foreach ($coords as $value) {
            if ($value === null || $value === '') {
                return null;
            }
        }

        $leftX = (int) $user->scan_window_top_left_galx;
        $topY = (int) $user->scan_window_top_left_galy;
        $rightX = (int) $user->scan_window_bottom_right_galx;
        $bottomY = (int) $user->scan_window_bottom_right_galy;

        return [
            'min_galx' => min($leftX, $rightX),
            'max_galx' => max($leftX, $rightX),
            'min_galy' => min($bottomY, $topY),
            'max_galy' => max($bottomY, $topY),
        ];
    }

    protected function resolveRequestedBounds(Request $request): ?array
    {
        $validated = $request->validate([
            'min_galx' => ['nullable', 'integer'],
            'max_galx' => ['nullable', 'integer'],
            'min_galy' => ['nullable', 'integer'],
            'max_galy' => ['nullable', 'integer'],
        ]);

        if (
            !array_key_exists('min_galx', $validated) ||
            !array_key_exists('max_galx', $validated) ||
            !array_key_exists('min_galy', $validated) ||
            !array_key_exists('max_galy', $validated) ||
            $validated['min_galx'] === null ||
            $validated['max_galx'] === null ||
            $validated['min_galy'] === null ||
            $validated['max_galy'] === null
        ) {
            return null;
        }

        return [
            'min_galx' => min((int) $validated['min_galx'], (int) $validated['max_galx']),
            'max_galx' => max((int) $validated['min_galx'], (int) $validated['max_galx']),
            'min_galy' => min((int) $validated['min_galy'], (int) $validated['max_galy']),
            'max_galy' => max((int) $validated['min_galy'], (int) $validated['max_galy']),
        ];
    }

    private function resolveSearchRecordPlayerName(SwcSectorSearchRecord $record): ?string
    {
        $name = trim((string) ($record->legacy_player ?? $record->legacy_handle ?? ''));
        if ($name !== '') {
            return $name;
        }

        if ($record->user_id) {
            $user = User::find($record->user_id, ['swc_handle', 'discord_global_name', 'discord_username']);
            foreach ([$user?->swc_handle, $user?->discord_global_name, $user?->discord_username] as $candidate) {
                $value = trim((string) ($candidate ?? ''));
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    private function mapSearchRecord(SwcSectorSearchRecord $record): array
    {
        return [
            'id' => $record->id,
            'sector_uid' => $record->sector_uid,
            'asteroid_uid' => $record->asteroid_uid,
            'galx' => $record->galx,
            'galy' => $record->galy,
            'square_name' => $record->square_name,
            'is_system_searched' => $record->is_system_searched,
            'has_asteroids' => $record->has_asteroids,
            'planetoids_checked' => $record->planetoids_checked,
            'planetoid_1_type' => $record->planetoid_1_type,
            'planetoid_1_size' => $record->planetoid_1_size,
            'planetoid_2_type' => $record->planetoid_2_type,
            'planetoid_2_size' => $record->planetoid_2_size,
            'has_ships' => $record->has_ships,
            'has_stations' => $record->has_stations,
            'legacy_note' => $record->legacy_note,
            'legacy_recorded_at' => $record->legacy_recorded_at?->toISOString(),
            'rescan_due_at' => $record->rescan_due_at?->toISOString(),
            'is_rescan_due' => $record->rescan_due_at
                ? $record->rescan_due_at->lte(Carbon::now())
                : false,
            'legacy_player' => $this->resolveSearchRecordPlayerName($record),
            'legacy_icon' => $record->legacy_icon,
            'handle' => $record->legacy_handle,
            'legacy_tag' => $record->legacy_tag,
            'legacy_read' => $record->legacy_read,
            'updated_at' => $record->updated_at?->toISOString(),
        ];
    }

    private function resolveLocationAsteroidField(int $galx, int $galy): ?array
    {
        $candidates = DB::table('droidbrain_system_scan_objects as scan_object')
            ->join('droidbrain_system_scans as scan', 'scan.id', '=', 'scan_object.scan_id')
            ->where('scan_object.galx', $galx)
            ->where('scan_object.galy', $galy)
            ->whereNotNull('scan_object.raw_json')
            ->where('scan_object.raw_json', 'like', '%fieldString%')
            ->orderByDesc('scan.snapshot_unixtime')
            ->orderByDesc('scan_object.id')
            ->limit(50)
            ->get([
                'scan.snapshot_unixtime',
                'scan_object.object_type',
                'scan_object.object_name',
                'scan_object.raw_json',
            ]);

        foreach ($candidates as $candidate) {
            $fieldString = $this->extractFieldStringFromRawJson(
                is_string($candidate->raw_json) ? $candidate->raw_json : null
            );
            if ($fieldString === null) {
                continue;
            }

            $map = $this->parseAsteroidFieldString($fieldString);
            if ($map === null) {
                continue;
            }

            return [
                ...$map,
                'snapshot_unixtime' => is_numeric((string) $candidate->snapshot_unixtime)
                    ? (int) $candidate->snapshot_unixtime
                    : null,
                'object_type' => is_string($candidate->object_type) ? $candidate->object_type : null,
                'object_name' => is_string($candidate->object_name) ? $candidate->object_name : null,
            ];
        }

        // Some scan exports only carry fieldString in the parent file XML, not in object raw_json.
        $xmlCandidates = DB::table('droidbrain_system_scans as scan')
            ->join('droidbrain_files as file', 'file.id', '=', 'scan.file_id')
            ->where('scan.galx', $galx)
            ->where('scan.galy', $galy)
            ->whereNotNull('file.raw_xml')
            ->whereRaw('LOWER(file.raw_xml) like ?', ['%fieldstring%'])
            ->orderByDesc('scan.snapshot_unixtime')
            ->orderByDesc('file.id')
            ->limit(25)
            ->get([
                'scan.snapshot_unixtime',
                'file.file_name',
                'file.raw_xml',
            ]);

        foreach ($xmlCandidates as $candidate) {
            $fieldString = $this->extractFieldStringFromRawXml(
                is_string($candidate->raw_xml) ? $candidate->raw_xml : null
            );
            if ($fieldString === null) {
                continue;
            }

            $map = $this->parseAsteroidFieldString($fieldString);
            if ($map === null) {
                continue;
            }

            return [
                ...$map,
                'snapshot_unixtime' => is_numeric((string) $candidate->snapshot_unixtime)
                    ? (int) $candidate->snapshot_unixtime
                    : null,
                'object_type' => 'xml_upload',
                'object_name' => is_string($candidate->file_name) ? $candidate->file_name : null,
            ];
        }

        return null;
    }

    private function extractFieldStringFromRawJson(?string $rawJson): ?string
    {
        if (!$rawJson) {
            return null;
        }

        $decoded = json_decode($rawJson, true);
        if (!is_array($decoded)) {
            return null;
        }

        return $this->findFieldStringInArray($decoded);
    }

    private function extractFieldStringFromRawXml(?string $rawXml): ?string
    {
        if (!$rawXml) {
            return null;
        }

        if (!preg_match('/<fieldString[^>]*>(.*?)<\/fieldString>/is', $rawXml, $matches)) {
            return null;
        }

        $value = trim(html_entity_decode(strip_tags((string) ($matches[1] ?? '')), ENT_QUOTES | ENT_HTML5));
        return $value !== '' ? $value : null;
    }

    private function findFieldStringInArray(array $payload): ?string
    {
        foreach ($payload as $key => $value) {
            if (is_string($key) && strtolower($key) === 'fieldstring') {
                $string = $this->normalizeFieldStringValue($value);
                if ($string !== null) {
                    return $string;
                }
            }

            if (is_array($value)) {
                $nested = $this->findFieldStringInArray($value);
                if ($nested !== null) {
                    return $nested;
                }
            }
        }

        return null;
    }

    private function normalizeFieldStringValue(mixed $value): ?string
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed !== '' ? $trimmed : null;
        }

        if (!is_array($value)) {
            return null;
        }

        $parts = [];
        array_walk_recursive($value, function (mixed $leaf) use (&$parts): void {
            if (is_string($leaf)) {
                $trimmed = trim($leaf);
                if ($trimmed !== '') {
                    $parts[] = $trimmed;
                }
            }
        });

        if ($parts === []) {
            return null;
        }

        return implode("\n", $parts);
    }

    private function parseAsteroidFieldString(string $fieldString): ?array
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $fieldString);
        $lines = array_values(array_filter(
            array_map(static fn (string $line): string => trim($line), explode("\n", $normalized)),
            static fn (string $line): bool => $line !== ''
        ));

        if ($lines === []) {
            return null;
        }

        $width = max(array_map(static fn (string $line): int => strlen($line), $lines));
        $rows = [];
        $mask = [];

        foreach ($lines as $line) {
            $chars = str_split($line);
            $rowChars = [];
            $rowMask = [];

            for ($x = 0; $x < $width; $x += 1) {
                $char = strtolower($chars[$x] ?? '.');
                $isAsteroid = $char === 'a';
                $rowChars[] = $isAsteroid ? 'a' : '.';
                $rowMask[] = $isAsteroid;
            }

            $rows[] = implode('', $rowChars);
            $mask[] = $rowMask;
        }

        return [
            'width' => $width,
            'height' => count($rows),
            'rows' => $rows,
            'mask' => $mask,
        ];
    }

    public function sectors(): JsonResponse
    {
        return $this->cachedListResponse('universe:sectors:index', 300, function () {
            return SwcSector::query()
                ->orderBy('name')
                ->get([
                    'id',
                    'uid',
                    'name',
                    'owner_uid',
                    'owner_name',
                    'population',
                    'known_systems',
                    'coordinate_count',
                    'system_count',
                    'color_r',
                    'color_g',
                    'color_b',
                    'color_hex',
                    'outline_coordinates',
                    'bounds',
                    'last_pulled_at',
                ])
                ->toArray();
        });
    }

    public function mapSystems(): JsonResponse
    {
        $requestedBounds = $this->resolveRequestedBounds(request());
        $cacheKey = 'universe:map-systems:' . md5(json_encode($requestedBounds));

        return $this->cachedListResponse($cacheKey, 300, function () use ($requestedBounds) {
            return SwcSystem::query()
                ->whereNotNull('galx')
                ->whereNotNull('galy')
                ->when($requestedBounds !== null, function ($query) use ($requestedBounds) {
                    $query
                        ->whereBetween('galx', [$requestedBounds['min_galx'], $requestedBounds['max_galx']])
                        ->whereBetween('galy', [$requestedBounds['min_galy'], $requestedBounds['max_galy']]);
                })
                ->orderBy('name')
                ->get([
                    'uid',
                    'identifier',
                    'name',
                    'sector_uid',
                    'sector_name',
                    'galx',
                    'galy',
                    'last_pulled_at',
                ])
                ->toArray();
        });
    }

    public function cacheManifest(): JsonResponse
    {
        $manifest = Cache::remember('universe:cache-manifest:v1', 15, function () {
            $sectorLastPulledAt = SwcSector::query()->max('last_pulled_at');
            $sectorUpdatedAt = SwcSector::query()->max('updated_at');
            $systemLastPulledAt = SwcSystem::query()->max('last_pulled_at');
            $systemUpdatedAt = SwcSystem::query()->max('updated_at');
            $searchRecordUpdatedAt = SwcSectorSearchRecord::query()->max('updated_at');
            $annotationUpdatedAt = SwcSectorCellAnnotation::query()->max('updated_at');

            $sectorsCount = (int) SwcSector::query()->count();
            $systemsCount = (int) SwcSystem::query()
                ->whereNotNull('galx')
                ->whereNotNull('galy')
                ->count();
            $searchRecordsCount = (int) SwcSectorSearchRecord::query()->count();
            $annotationsCount = (int) SwcSectorCellAnnotation::query()->count();

            $snapshot = [
                'sectors' => [
                    'count' => $sectorsCount,
                    'last_pulled_at' => $sectorLastPulledAt ? Carbon::parse((string) $sectorLastPulledAt)->toISOString() : null,
                    'updated_at' => $sectorUpdatedAt ? Carbon::parse((string) $sectorUpdatedAt)->toISOString() : null,
                ],
                'map_systems' => [
                    'count' => $systemsCount,
                    'last_pulled_at' => $systemLastPulledAt ? Carbon::parse((string) $systemLastPulledAt)->toISOString() : null,
                    'updated_at' => $systemUpdatedAt ? Carbon::parse((string) $systemUpdatedAt)->toISOString() : null,
                ],
                'search_records' => [
                    'count' => $searchRecordsCount,
                    'updated_at' => $searchRecordUpdatedAt ? Carbon::parse((string) $searchRecordUpdatedAt)->toISOString() : null,
                ],
                'cell_annotations' => [
                    'count' => $annotationsCount,
                    'updated_at' => $annotationUpdatedAt ? Carbon::parse((string) $annotationUpdatedAt)->toISOString() : null,
                ],
            ];

            return [
                'revision' => sha1(json_encode($snapshot)),
                'snapshot' => $snapshot,
                'generated_at' => now()->toISOString(),
            ];
        });

        return response()->json([
            'ok' => true,
            'data' => $manifest,
        ]);
    }

    public function galaxySnapshotMeta(Request $request): JsonResponse
    {
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);
        $scanWindow = $this->resolveScanWindow($request);
        $canViewScanWindow = $scanWindow !== null;
        $joeMemberId = $this->resolveJoeMemberId($request);
        $manifest = $this->cacheManifest()->getData(true);
        $manifestRevision = data_get($manifest, 'data.revision', 'none');
        $scopeHash = sha1(json_encode([
            'can_view_asteroid_intel' => $canViewAsteroidIntel,
            'can_view_scan_window' => $canViewScanWindow,
            'scan_window' => $scanWindow,
            'joe_member_id' => $joeMemberId,
        ], JSON_THROW_ON_ERROR));
        $cacheKey = sprintf('universe:galaxy-snapshot:meta:%s:%s', $manifestRevision, $scopeHash);

        $meta = Cache::remember($cacheKey, 30, function () use ($canViewAsteroidIntel, $canViewScanWindow, $scanWindow, $joeMemberId, $manifestRevision, $scopeHash) {
            $systemsCount = (int) SwcSystem::query()
                ->whereNotNull('galx')
                ->whereNotNull('galy')
                ->count();

            $searchRecordBaseQuery = SwcSectorSearchRecord::query();
            if (!$canViewAsteroidIntel && $canViewScanWindow && $scanWindow) {
                $searchRecordBaseQuery
                    ->whereBetween('galx', [$scanWindow['min_galx'], $scanWindow['max_galx']])
                    ->whereBetween('galy', [$scanWindow['min_galy'], $scanWindow['max_galy']]);
            } elseif (!$canViewAsteroidIntel && !$canViewScanWindow && $joeMemberId) {
                $searchRecordBaseQuery->where('user_id', $joeMemberId);
            }

            $canViewRecords = $canViewAsteroidIntel || $canViewScanWindow || $joeMemberId;

            $asteroidsCount = $canViewAsteroidIntel
                ? (clone $searchRecordBaseQuery)->where('has_asteroids', true)->count()
                : 0;
            $scansCount = $canViewRecords
                ? (clone $searchRecordBaseQuery)->where(function ($q) {
                    $q->where('is_system_searched', true)
                      ->orWhereNotNull('legacy_recorded_at')
                      ->orWhereNotNull('legacy_player');
                })->count()
                : 0;
            $shipsCount = $canViewAsteroidIntel
                ? (clone $searchRecordBaseQuery)->where('has_ships', true)->count()
                : 0;
            $stationsCount = $canViewAsteroidIntel
                ? (clone $searchRecordBaseQuery)->where('has_stations', true)->count()
                : 0;
            $notesCount = $canViewAsteroidIntel
                ? SwcSectorCellAnnotation::query()
                    ->whereRaw("TRIM(COALESCE(notes, '')) <> ''")
                    ->count()
                : 0;

            return [
                'revision' => sha1($manifestRevision . ':' . $scopeHash),
                'manifest_revision' => $manifestRevision,
                'can_view_asteroid_intel' => $canViewAsteroidIntel,
                'can_view_scan_window' => $canViewScanWindow,
                'layers' => [
                    ['name' => 'sectors', 'count' => (int) SwcSector::query()->count(), 'available' => true],
                    ['name' => 'systems', 'count' => $systemsCount, 'available' => true],
                    ['name' => 'asteroids', 'count' => $asteroidsCount, 'available' => $canViewAsteroidIntel],
                    ['name' => 'scans', 'count' => $scansCount, 'available' => ($canViewAsteroidIntel || $canViewScanWindow || (bool) $joeMemberId)],
                    ['name' => 'notes', 'count' => $notesCount, 'available' => $canViewAsteroidIntel],
                    ['name' => 'ships', 'count' => $shipsCount, 'available' => $canViewAsteroidIntel],
                    ['name' => 'stations', 'count' => $stationsCount, 'available' => $canViewAsteroidIntel],
                ],
                'generated_at' => now()->toISOString(),
            ];
        });

        return response()->json([
            'ok' => true,
            'data' => $meta,
        ]);
    }

    public function galaxySnapshotLayer(Request $request, string $layer): JsonResponse
    {
        $layer = trim(strtolower($layer));
        $allowedLayers = ['sectors', 'systems', 'asteroids', 'scans', 'notes', 'ships', 'stations'];
        if (!in_array($layer, $allowedLayers, true)) {
            return response()->json([
                'ok' => false,
                'message' => 'Unsupported layer.',
                'data' => [],
            ], 422);
        }

        $isFullTier = $this->toolAccessService->tierForUser($request->user()) === ToolAccessService::TIER_FULL;
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);
        $scanWindow = $this->resolveScanWindow($request);
        $canViewScanWindow = $scanWindow !== null;
        $joeMemberId = $this->resolveJoeMemberId($request);

        $scopeHash = sha1(json_encode([
            'can_view_asteroid_intel' => $canViewAsteroidIntel,
            'can_view_scan_window' => $canViewScanWindow,
            'scan_window' => $scanWindow,
            'joe_member_id' => $joeMemberId,
        ], JSON_THROW_ON_ERROR));
        $searchRecordsVersion = (int) Cache::get(self::SEARCH_RECORDS_CACHE_VERSION_KEY, 1);
        $annotationsVersion = (int) Cache::get(self::CELL_ANNOTATIONS_CACHE_VERSION_KEY, 1);

        // Small layers (sectors, systems, notes) are safe to cache in the file store.
        // Large record layers (asteroids, scans, ships, stations) can have 30k+ rows and
        // serializing them to the file cache exhausts the PHP memory limit, so they are
        // computed on every request (the DB query is fast and results are ~4s to build).
        $cacheable = in_array($layer, ['sectors', 'systems', 'notes'], true);

        $cacheVersion = match ($layer) {
            'notes' => $annotationsVersion,
            'asteroids', 'scans', 'ships', 'stations' => $searchRecordsVersion,
            default => 1,
        };
        $cacheKey = sprintf(
            'universe:galaxy-snapshot:layer:%s:v%d:%s',
            $layer,
            $cacheVersion,
            $scopeHash
        );

        $buildPayload = function () use ($layer, $canViewAsteroidIntel, $canViewScanWindow, $scanWindow, $isFullTier, $joeMemberId) {
            if ($layer === 'sectors') {
                return SwcSector::query()
                    ->orderBy('name')
                    ->get([
                        'id',
                        'uid',
                        'name',
                        'owner_uid',
                        'owner_name',
                        'population',
                        'known_systems',
                        'coordinate_count',
                        'system_count',
                        'color_r',
                        'color_g',
                        'color_b',
                        'color_hex',
                        'outline_coordinates',
                        'bounds',
                        'last_pulled_at',
                    ])
                    ->map(function ($sector) use ($isFullTier) {
                        $data = $sector->toArray();
                        if (!$isFullTier) {
                            $data['population'] = null;
                        }
                        return $data;
                    })
                    ->toArray();
            }

            if ($layer === 'systems') {
                return SwcSystem::query()
                    ->whereNotNull('galx')
                    ->whereNotNull('galy')
                    ->orderBy('name')
                    ->get([
                        'uid',
                        'identifier',
                        'name',
                        'sector_uid',
                        'sector_name',
                        'galx',
                        'galy',
                        'last_pulled_at',
                    ])
                    ->toArray();
            }

            if ($layer === 'notes') {
                if (!$canViewAsteroidIntel) {
                    return [];
                }

                return SwcSectorCellAnnotation::query()
                    ->whereNull('owner_user_id')
                    ->whereRaw("TRIM(COALESCE(notes, '')) <> ''")
                    ->orderBy('galy')
                    ->orderBy('galx')
                    ->get([
                        'id',
                        'sector_uid',
                        'galx',
                        'galy',
                        'marker_type',
                        'label',
                        'notes',
                        'created_at',
                        'updated_at',
                    ])
                    ->toArray();
            }

            if (!$canViewAsteroidIntel && !$canViewScanWindow && !$joeMemberId) {
                return [];
            }

            $recordsQuery = DB::table('swc_sector_search_records');

            if (!$canViewAsteroidIntel && $canViewScanWindow && $scanWindow) {
                $recordsQuery
                    ->whereBetween('galx', [$scanWindow['min_galx'], $scanWindow['max_galx']])
                    ->whereBetween('galy', [$scanWindow['min_galy'], $scanWindow['max_galy']]);
            } elseif (!$canViewAsteroidIntel && !$canViewScanWindow && $joeMemberId) {
                // JOE member without full intel — show only records they personally imported
                $recordsQuery->where('user_id', $joeMemberId);
            }

            match ($layer) {
                'asteroids' => $recordsQuery->where('has_asteroids', true),
                'scans' => $recordsQuery->where(function ($q) {
                    $q->where('is_system_searched', true)
                      ->orWhereNotNull('legacy_recorded_at')
                      ->orWhereNotNull('legacy_player');
                }),
                'ships' => $recordsQuery->where('has_ships', true),
                'stations' => $recordsQuery->where('has_stations', true),
                default => null,
            };

            $records = $recordsQuery
                ->orderBy('galy')
                ->orderBy('galx')
                ->get([
                    'id',
                    'user_id',
                    'sector_uid',
                    'asteroid_uid',
                    'galx',
                    'galy',
                    'square_name',
                    'is_system_searched',
                    'has_asteroids',
                    'planetoids_checked',
                    'planetoid_1_size',
                    'planetoid_2_size',
                    'has_ships',
                    'has_stations',
                    'legacy_player',
                    'legacy_handle',
                    'legacy_recorded_at',
                    'rescan_due_at',
                    'updated_at',
                ]);

            $userIds = $records->pluck('user_id')->filter()->unique()->values()->all();
            $userMap = count($userIds) > 0
                ? User::whereIn('id', $userIds)->get(['id', 'swc_handle', 'discord_global_name', 'discord_username'])->keyBy('id')
                : collect();

            return $records
                ->map(function ($record) use ($canViewAsteroidIntel, $userMap) {
                    $handle = null;
                    $rawName = trim((string) ($record->legacy_player ?? $record->legacy_handle ?? ''));
                    if ($rawName !== '') {
                        $handle = $rawName;
                    } elseif ($record->user_id && $userMap->has($record->user_id)) {
                        $user = $userMap->get($record->user_id);
                        foreach ([$user?->swc_handle, $user?->discord_global_name, $user?->discord_username] as $candidate) {
                            $value = trim((string) ($candidate ?? ''));
                            if ($value !== '') {
                                $handle = $value;
                                break;
                            }
                        }
                    }

                    return [
                        'id' => (int) $record->id,
                        'sector_uid' => $record->sector_uid,
                        'asteroid_uid' => $canViewAsteroidIntel ? $record->asteroid_uid : null,
                        'galx' => (int) $record->galx,
                        'galy' => (int) $record->galy,
                        'square_name' => $record->square_name,
                        'is_system_searched' => (bool) $record->is_system_searched,
                        'has_asteroids' => $canViewAsteroidIntel ? (bool) $record->has_asteroids : false,
                        'planetoids_checked' => $canViewAsteroidIntel ? $record->planetoids_checked : null,
                        'planetoid_1_size' => $canViewAsteroidIntel ? $record->planetoid_1_size : null,
                        'planetoid_2_size' => $canViewAsteroidIntel ? $record->planetoid_2_size : null,
                        'has_ships' => $canViewAsteroidIntel ? ($record->has_ships === null ? null : (bool) $record->has_ships) : null,
                        'has_stations' => $canViewAsteroidIntel ? ($record->has_stations === null ? null : (bool) $record->has_stations) : null,
                        'legacy_player' => $handle,
                        'handle' => $handle,
                        'legacy_recorded_at' => $record->legacy_recorded_at
                            ? Carbon::parse($record->legacy_recorded_at)->toISOString()
                            : null,
                        'rescan_due_at' => $record->rescan_due_at
                            ? Carbon::parse($record->rescan_due_at)->toISOString()
                            : null,
                        'updated_at' => $record->updated_at
                            ? Carbon::parse($record->updated_at)->toISOString()
                            : null,
                    ];
                })
                ->values()
                ->all();
        };

        $payload = $cacheable
            ? Cache::remember($cacheKey, 120, $buildPayload)
            : $buildPayload();

        return response()->json([
            'ok' => true,
            'data' => $payload,
        ]);
    }

    public function hyperPlans(Request $request): JsonResponse
    {
        $user = $request->user();

        $plans = HyperPlan::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $plans->map(fn (HyperPlan $plan) => $this->serializeHyperPlan($plan))->values(),
        ]);
    }

    public function storeHyperPlan(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'from_system_identifier' => ['required', 'string', 'max:255'],
            'from_system_name' => ['nullable', 'string', 'max:255'],
            'to_system_identifier' => ['required', 'string', 'max:255'],
            'to_system_name' => ['nullable', 'string', 'max:255'],
            'ship_uid' => ['nullable', 'string', 'max:255'],
            'ship_name' => ['nullable', 'string', 'max:255'],
            'ship_class_name' => ['nullable', 'string', 'max:255'],
            'hyperspeed' => ['required', 'integer', 'min:1', 'max:15'],
            'piloting_skill' => ['required', 'integer', 'min:0', 'max:5'],
        ]);

        $plan = HyperPlan::query()->create([
            ...$validated,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Hyper plan saved.',
            'data' => $this->serializeHyperPlan($plan),
        ]);
    }

    public function deleteHyperPlan(Request $request, HyperPlan $hyperPlan): JsonResponse
    {
        $user = $request->user();

        if ((int) $hyperPlan->user_id !== (int) $user->id) {
            return response()->json([
                'message' => 'That hyper plan does not belong to you.',
            ], 403);
        }

        $hyperPlan->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Hyper plan deleted.',
        ]);
    }

    public function hyperPlanner(Request $request): JsonResponse
    {
        try {
            // The planner reads a large slice of the universe graph. Use lighter
            // query-builder rows here so production does not exhaust memory while
            // hydrating thousands of full Eloquent models.
            $validated = $request->validate([
                'from' => ['required', 'string', 'max:255'],
                'to' => ['required', 'string', 'max:255'],
                'piloting_skill' => ['nullable', 'integer', 'min:0', 'max:5'],
                'hyperspeed' => ['nullable', 'integer', 'min:1', 'max:15'],
            ]);

            $pilotingSkill = (int) ($validated['piloting_skill'] ?? 0);
            $hyperspeed = (int) ($validated['hyperspeed'] ?? 1);
            $hyperlaneSpeedLimit = 0.55;
            $directJourneyLength = 0;
            $directTripSeconds = 0;

            $systems = DB::table('swc_systems')
                ->whereNotNull('galx')
                ->whereNotNull('galy')
                ->get([
                    'id',
                    'uid',
                    'identifier',
                    'name',
                    'sector_uid',
                    'sector_name',
                    'galx',
                    'galy',
                ]);

            $systemsById = $systems->keyBy('id');
            $systemsByUid = $systems
                ->filter(fn ($system) => is_string($system->uid) && trim($system->uid) !== '')
                ->keyBy(fn ($system) => trim((string) $system->uid));
            $systemsByIdentifier = $systems
                ->filter(fn ($system) => is_string($system->identifier) && trim((string) $system->identifier) !== '')
                ->keyBy(fn ($system) => trim((string) $system->identifier));
            $systemsByCoords = $systems->keyBy(fn ($system) => $this->systemCoordKey($system->galx, $system->galy));
            $systemsByName = [];

            foreach ($systems as $system) {
                $normalizedName = $this->normalizeSystemLookupValue($system->name);
                if ($normalizedName && !isset($systemsByName[$normalizedName])) {
                    $systemsByName[$normalizedName] = $system;
                }
            }

            $fromEndpoint = $this->resolvePlannerEndpoint(
                $validated['from'],
                $systemsByUid->all(),
                $systemsByIdentifier->all(),
                $systemsByName
            );
            $toEndpoint = $this->resolvePlannerEndpoint(
                $validated['to'],
                $systemsByUid->all(),
                $systemsByIdentifier->all(),
                $systemsByName
            );

            if (!$fromEndpoint || !$toEndpoint) {
                return response()->json([
                    'ok' => false,
                    'message' => !$fromEndpoint
                        ? 'The starting system or coordinates could not be resolved.'
                        : 'The destination system or coordinates could not be resolved.',
                ], 404);
            }

            if (
                (int) $fromEndpoint['galx'] === (int) $toEndpoint['galx']
                && (int) $fromEndpoint['galy'] === (int) $toEndpoint['galy']
            ) {
                return response()->json([
                    'ok' => true,
                    'data' => [
                        'from' => $this->serializePlannerEndpoint($fromEndpoint),
                        'to' => $this->serializePlannerEndpoint($toEndpoint),
                        'summary' => [
                            'hop_count' => 0,
                            'visited_systems' => 1,
                            'total_modifier' => 0,
                            'average_modifier' => null,
                            'direct_seconds' => 0,
                            'direct_formatted_time' => 'Less than a second',
                            'time_saved_seconds' => 0,
                            'time_saved_formatted' => 'Less than a second',
                            'total_seconds' => 0,
                            'formatted_time' => 'Less than a second',
                            'piloting_skill' => $pilotingSkill,
                            'hyperspeed' => $hyperspeed,
                        ],
                        'systems' => [$this->serializePlannerEndpoint($fromEndpoint)],
                        'hops' => [],
                    ],
                ]);
            }

            $directJourneyLength = $this->calculatePlannerJourneyLength(
                $fromEndpoint['galx'],
                $fromEndpoint['galy'],
                $toEndpoint['galx'],
                $toEndpoint['galy']
            );
            $directTripSeconds = $this->calculatePlannerDirectTravelSeconds(
                $directJourneyLength,
                $pilotingSkill,
                $hyperspeed
            );

            $adjacency = [];

            foreach (
                DB::table('swc_hyperlanes')->orderBy('name')->get([
                'uid',
                'source_system_id',
                'name',
                'destination_uid',
                'destination_name',
                'destination_galx',
                'destination_galy',
                'owner_name',
                'blocks',
                'modifier',
                ]) as $hyperlane
            ) {
            $destinationSystem = null;

            if ($hyperlane->destination_uid && isset($systemsByUid[trim((string) $hyperlane->destination_uid)])) {
                $destinationSystem = $systemsByUid[trim((string) $hyperlane->destination_uid)];
            }

            if (
                !$destinationSystem &&
                $hyperlane->destination_galx !== null &&
                $hyperlane->destination_galy !== null
            ) {
                $destinationSystem = $systemsByCoords->get(
                    $this->systemCoordKey($hyperlane->destination_galx, $hyperlane->destination_galy)
                );
            }

            if (!$destinationSystem && $hyperlane->destination_name) {
                $destinationSystem = $systemsByName[$this->normalizeSystemLookupValue($hyperlane->destination_name)] ?? null;
            }

            if (!$destinationSystem || !isset($systemsById[$hyperlane->source_system_id])) {
                continue;
            }

            $sourceSystem = $systemsById->get($hyperlane->source_system_id);
            if (!$sourceSystem) {
                continue;
            }

            $journeyLength = $this->calculatePlannerJourneyLength(
                $sourceSystem->galx,
                $sourceSystem->galy,
                $destinationSystem->galx,
                $destinationSystem->galy
            );
            $existingLaneBlocks = $this->toPlannerInt($hyperlane->blocks);
            $blocksUsed = $existingLaneBlocks;
            $storedModifier = $hyperlane->modifier !== null ? (float) $hyperlane->modifier : null;
            $normalizedStoredModifier = $storedModifier !== null
                ? $this->normalizePlannerStoredModifier($storedModifier)
                : null;
            $timeModifier = $normalizedStoredModifier !== null
                ? $normalizedStoredModifier
                : $this->calculatePlannerTimeModifier(
                    $hyperlaneSpeedLimit,
                    $journeyLength,
                    $blocksUsed
                );
            $directSeconds = $this->calculatePlannerDirectTravelSeconds(
                $journeyLength,
                $pilotingSkill,
                $hyperspeed
            );
            $laneSeconds = (int) ceil($directSeconds * $timeModifier);

            $adjacency[$hyperlane->source_system_id][] = [
                'lane_uid' => $hyperlane->uid,
                'lane_name' => $hyperlane->name,
                'source_system_id' => (int) $hyperlane->source_system_id,
                'destination_system_id' => (int) $destinationSystem->id,
                'destination_uid' => $destinationSystem->uid,
                'destination_name' => $destinationSystem->name,
                'destination_galx' => $destinationSystem->galx,
                'destination_galy' => $destinationSystem->galy,
                'owner_name' => $hyperlane->owner_name,
                'blocks' => $hyperlane->blocks,
                'modifier' => $hyperlane->modifier,
                'existing_blocks' => $existingLaneBlocks,
                'blocks_used' => $blocksUsed,
                'journey_length' => $journeyLength,
                'direct_seconds' => $directSeconds,
                'time_modifier' => $timeModifier,
                'lane_seconds' => $laneSeconds,
            ];
        }

            $startNode = ($fromEndpoint['kind'] === 'system' && isset($fromEndpoint['system']) && $fromEndpoint['system'])
                ? (string) $fromEndpoint['system']->id
                : '__start__';
            $endNode = ($toEndpoint['kind'] === 'system' && isset($toEndpoint['system']) && $toEndpoint['system'])
                ? (string) $toEndpoint['system']->id
                : '__end__';

            if ($startNode === '__start__') {
                foreach ($systems as $system) {
                $directSeconds = $this->calculatePlannerDirectTravelSeconds(
                    $this->calculatePlannerJourneyLength($fromEndpoint['galx'], $fromEndpoint['galy'], $system->galx, $system->galy),
                    $pilotingSkill,
                    $hyperspeed
                );

                $adjacency[$startNode][] = [
                    'hop_type' => 'direct',
                    'lane_uid' => null,
                    'lane_name' => 'Direct jump to system',
                    'source_system_id' => null,
                    'destination_system_id' => (int) $system->id,
                    'destination_uid' => $system->uid,
                    'destination_name' => $system->name,
                    'destination_galx' => $system->galx,
                    'destination_galy' => $system->galy,
                    'owner_name' => null,
                    'blocks' => null,
                    'modifier' => 1.0,
                    'existing_blocks' => 0,
                    'blocks_used' => 0,
                    'journey_length' => $this->calculatePlannerJourneyLength($fromEndpoint['galx'], $fromEndpoint['galy'], $system->galx, $system->galy),
                    'direct_seconds' => $directSeconds,
                    'time_modifier' => 1.0,
                    'lane_seconds' => $directSeconds,
                    'from_endpoint' => $fromEndpoint,
                    'to_endpoint' => [
                        'kind' => 'system',
                        'system' => $system,
                        'galx' => $system->galx,
                        'galy' => $system->galy,
                        'identifier' => $system->identifier ?: $system->uid,
                        'name' => $system->name,
                    ],
                ];
                }
            }

            if ($endNode === '__end__') {
                foreach ($systems as $system) {
                $directSeconds = $this->calculatePlannerDirectTravelSeconds(
                    $this->calculatePlannerJourneyLength($system->galx, $system->galy, $toEndpoint['galx'], $toEndpoint['galy']),
                    $pilotingSkill,
                    $hyperspeed
                );

                $adjacency[(string) $system->id][] = [
                    'hop_type' => 'direct',
                    'lane_uid' => null,
                    'lane_name' => 'Direct jump to destination',
                    'source_system_id' => (int) $system->id,
                    'destination_system_id' => null,
                    'destination_uid' => null,
                    'destination_name' => $toEndpoint['name'],
                    'destination_galx' => $toEndpoint['galx'],
                    'destination_galy' => $toEndpoint['galy'],
                    'owner_name' => null,
                    'blocks' => null,
                    'modifier' => 1.0,
                    'existing_blocks' => 0,
                    'blocks_used' => 0,
                    'journey_length' => $this->calculatePlannerJourneyLength($system->galx, $system->galy, $toEndpoint['galx'], $toEndpoint['galy']),
                    'direct_seconds' => $directSeconds,
                    'time_modifier' => 1.0,
                    'lane_seconds' => $directSeconds,
                    'from_endpoint' => [
                        'kind' => 'system',
                        'system' => $system,
                        'galx' => $system->galx,
                        'galy' => $system->galy,
                        'identifier' => $system->identifier ?: $system->uid,
                        'name' => $system->name,
                    ],
                    'to_endpoint' => $toEndpoint,
                    'destination_node' => $endNode,
                ];
                }
            }

            if ($startNode === '__start__' && $endNode === '__end__') {
                $directSeconds = $this->calculatePlannerDirectTravelSeconds(
                $this->calculatePlannerJourneyLength($fromEndpoint['galx'], $fromEndpoint['galy'], $toEndpoint['galx'], $toEndpoint['galy']),
                $pilotingSkill,
                $hyperspeed
            );
                $adjacency[$startNode][] = [
                'hop_type' => 'direct',
                'lane_uid' => null,
                'lane_name' => 'Direct jump',
                'source_system_id' => null,
                'destination_system_id' => null,
                'destination_uid' => null,
                'destination_name' => $toEndpoint['name'],
                'destination_galx' => $toEndpoint['galx'],
                'destination_galy' => $toEndpoint['galy'],
                'owner_name' => null,
                'blocks' => null,
                'modifier' => 1.0,
                'existing_blocks' => 0,
                'blocks_used' => 0,
                'journey_length' => $this->calculatePlannerJourneyLength($fromEndpoint['galx'], $fromEndpoint['galy'], $toEndpoint['galx'], $toEndpoint['galy']),
                'direct_seconds' => $directSeconds,
                'time_modifier' => 1.0,
                'lane_seconds' => $directSeconds,
                'from_endpoint' => $fromEndpoint,
                'to_endpoint' => $toEndpoint,
                'destination_node' => $endNode,
                ];
            }

            $fastestHopEdges = $this->findPlannerShortestPathEdges(
                $adjacency,
                $systemsById,
                $startNode,
                $endNode,
                $toEndpoint,
                $pilotingSkill,
                $hyperspeed,
                $directTripSeconds
            );

            if (empty($fastestHopEdges)) {
                return response()->json([
                    'ok' => false,
                    'message' => 'No stored hyperlane routes were found that beat direct travel between those systems.',
                ], 404);
            }

            $routeOptions = [];
            $visitedSystems = 0;

            $fastestRoutePayload = $this->buildPlannerRoutePayload(
                $fromEndpoint,
                $toEndpoint,
                $fastestHopEdges,
                $systemsById,
                $pilotingSkill,
                $hyperspeed,
                $visitedSystems
            );
            $routeOptions[] = $fastestRoutePayload;
            $routeOptions = [[
                ...$fastestRoutePayload,
                'route_index' => 0,
                'route_label' => 'Route 1',
            ]];
            $fastestRoute = $routeOptions[0];

            return response()->json([
                'ok' => true,
                'data' => [
                    ...$fastestRoute,
                    'routes' => $routeOptions,
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Hyper Planner failed.', [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'piloting_skill' => $request->query('piloting_skill'),
                'hyperspeed' => $request->query('hyperspeed'),
                'message' => $e->getMessage(),
                'exception' => get_class($e),
            ]);

            return response()->json([
                'ok' => false,
                'message' => 'Hyper Planner could not calculate that route right now.',
                'error_code' => 'hyper_planner_failed',
            ], 500);
        }
    }

    protected function buildPlannerRoutePayload(
        array $fromEndpoint,
        array $toEndpoint,
        array $hopEdges,
        $systemsById,
        int $pilotingSkill,
        int $hyperspeed,
        int $visitedSystems
    ): array {
        $directTripSeconds = $this->calculatePlannerDirectTravelSeconds(
            $this->calculatePlannerJourneyLength(
                $fromEndpoint['galx'],
                $fromEndpoint['galy'],
                $toEndpoint['galx'],
                $toEndpoint['galy']
            ),
            $pilotingSkill,
            $hyperspeed
        );

        $routeSystems = [$this->serializePlannerEndpoint($fromEndpoint)];
        $totalModifier = 0.0;
        $modifierCount = 0;
        $totalSeconds = 0;
        $hops = [];

        foreach ($hopEdges as $edge) {
            $modifier = $edge['modifier'] !== null ? (float) $edge['modifier'] : null;
            if ($modifier !== null) {
                $totalModifier += $modifier;
                $modifierCount++;
            }

            $timeModifier = (float) ($edge['time_modifier'] ?? 1.0);
            $directSeconds = (int) ($edge['direct_seconds'] ?? 0);
            $laneSeconds = (int) ($edge['lane_seconds'] ?? 0);
            $journeyLength = (int) ($edge['journey_length'] ?? 0);
            $blocksUsed = (int) ($edge['blocks_used'] ?? 0);
            $existingBlocks = (int) ($edge['existing_blocks'] ?? 0);
            $totalSeconds += $laneSeconds;

            $hops[] = [
                'hop_type' => $edge['hop_type'] ?? 'hyperlane',
                'lane_uid' => $edge['lane_uid'],
                'lane_name' => $edge['lane_name'],
                'owner_name' => $edge['owner_name'],
                'blocks' => $edge['blocks'],
                'modifier' => $modifier,
                'existing_blocks' => $existingBlocks,
                'blocks_used' => $blocksUsed,
                'journey_length' => $journeyLength,
                'direct_seconds' => $directSeconds,
                'direct_formatted_time' => $this->formatPlannerTime($directSeconds),
                'time_modifier' => round($timeModifier, 4),
                'lane_seconds' => $laneSeconds,
                'formatted_time' => $this->formatPlannerTime($laneSeconds),
                'from' => $this->serializePlannerEndpoint(
                    $edge['from_endpoint']
                        ?? $this->buildPlannerSystemEndpoint($systemsById->get($edge['source_system_id']))
                ),
                'to' => $this->serializePlannerEndpoint(
                    $edge['to_endpoint']
                        ?? $this->buildPlannerSystemEndpoint($systemsById->get($edge['destination_system_id']))
                ),
            ];

            $routeSystems[] = $this->serializePlannerEndpoint(
                $edge['to_endpoint']
                    ?? $this->buildPlannerSystemEndpoint($systemsById->get($edge['destination_system_id']))
            );
        }

        $timeSavedSeconds = max(0, $directTripSeconds - $totalSeconds);

        return [
            'from' => $this->serializePlannerEndpoint($fromEndpoint),
            'to' => $this->serializePlannerEndpoint($toEndpoint),
            'summary' => [
                'hop_count' => count($hops),
                'visited_systems' => $visitedSystems,
                'total_modifier' => $modifierCount > 0 ? round($totalModifier, 2) : null,
                'average_modifier' => $modifierCount > 0 ? round($totalModifier / $modifierCount, 2) : null,
                'direct_seconds' => $directTripSeconds,
                'direct_formatted_time' => $this->formatPlannerTime($directTripSeconds),
                'time_saved_seconds' => $timeSavedSeconds,
                'time_saved_formatted' => $this->formatPlannerTime($timeSavedSeconds),
                'total_seconds' => $totalSeconds,
                'formatted_time' => $this->formatPlannerTime($totalSeconds),
                'piloting_skill' => $pilotingSkill,
                'hyperspeed' => $hyperspeed,
            ],
            'systems' => $routeSystems,
            'hops' => $hops,
        ];
    }

    protected function buildPlannerDirectEdgeToEndpoint(
        object $sourceSystem,
        array $toEndpoint,
        string $endNode,
        int $pilotingSkill,
        int $hyperspeed
    ): array {
        $journeyLength = $this->calculatePlannerJourneyLength(
            $sourceSystem->galx,
            $sourceSystem->galy,
            $toEndpoint['galx'],
            $toEndpoint['galy']
        );
        $directSeconds = $this->calculatePlannerDirectTravelSeconds(
            $journeyLength,
            $pilotingSkill,
            $hyperspeed
        );

        return [
            'hop_type' => 'direct',
            'lane_uid' => null,
            'lane_name' => 'Direct jump to destination',
            'source_system_id' => (int) $sourceSystem->id,
            'destination_system_id' => null,
            'destination_uid' => $toEndpoint['system']->uid ?? null,
            'destination_name' => $toEndpoint['name'] ?? ($toEndpoint['system']->name ?? null),
            'destination_galx' => $toEndpoint['galx'],
            'destination_galy' => $toEndpoint['galy'],
            'owner_name' => null,
            'blocks' => null,
            'modifier' => 1.0,
            'existing_blocks' => 0,
            'blocks_used' => 0,
            'journey_length' => $journeyLength,
            'direct_seconds' => $directSeconds,
            'time_modifier' => 1.0,
            'lane_seconds' => $directSeconds,
            'from_endpoint' => $this->buildPlannerSystemEndpoint($sourceSystem),
            'to_endpoint' => $toEndpoint,
            'destination_node' => $endNode,
        ];
    }

    protected function buildPlannerCandidateEdgesForNode(
        array $adjacency,
        $systemsById,
        string $systemId,
        string $endNode,
        array $toEndpoint,
        int $pilotingSkill,
        int $hyperspeed
    ): array {
        $candidateEdges = $adjacency[$systemId] ?? [];

        if ($endNode !== '__end__' && $systemId !== $endNode && ctype_digit($systemId)) {
            $currentSystem = $systemsById->get((int) $systemId);
            if ($currentSystem) {
                $candidateEdges[] = $this->buildPlannerDirectEdgeToEndpoint(
                    $currentSystem,
                    $toEndpoint,
                    $endNode,
                    $pilotingSkill,
                    $hyperspeed
                );
            }
        }

        return $candidateEdges;
    }

    protected function findPlannerShortestPathEdges(
        array $adjacency,
        $systemsById,
        string $startNode,
        string $endNode,
        array $toEndpoint,
        int $pilotingSkill,
        int $hyperspeed,
        int $directTripSeconds
    ): array {
        $distances = [$startNode => 0];
        $previousEdges = [];
        $previousNodes = [];

        $queue = new \SplPriorityQueue();
        $queue->setExtractFlags(\SplPriorityQueue::EXTR_DATA);
        $queue->insert([
            'node' => $startNode,
            'seconds' => 0,
        ], 0);

        while (!$queue->isEmpty()) {
            $state = $queue->extract();
            $systemId = (string) ($state['node'] ?? '');
            $elapsedSeconds = (int) ($state['seconds'] ?? 0);

            if ($elapsedSeconds > ($distances[$systemId] ?? PHP_INT_MAX)) {
                continue;
            }

            if ($systemId === $endNode) {
                break;
            }

            $candidateEdges = $this->buildPlannerCandidateEdgesForNode(
                $adjacency,
                $systemsById,
                $systemId,
                $endNode,
                $toEndpoint,
                $pilotingSkill,
                $hyperspeed
            );

            foreach ($candidateEdges as $edge) {
                $destinationId = (string) ($edge['destination_node'] ?? $edge['destination_system_id']);
                $candidateSeconds = $elapsedSeconds + (int) ($edge['lane_seconds'] ?? 0);

                if ($candidateSeconds >= $directTripSeconds) {
                    continue;
                }

                if ($candidateSeconds >= ($distances[$destinationId] ?? PHP_INT_MAX)) {
                    continue;
                }

                $distances[$destinationId] = $candidateSeconds;
                $previousNodes[$destinationId] = $systemId;
                $previousEdges[$destinationId] = $edge;
                $queue->insert([
                    'node' => $destinationId,
                    'seconds' => $candidateSeconds,
                ], -$candidateSeconds);
            }
        }

        if (!isset($previousEdges[$endNode])) {
            return [];
        }

        $edges = [];
        $cursor = $endNode;

        while ($cursor !== $startNode && isset($previousEdges[$cursor])) {
            array_unshift($edges, $previousEdges[$cursor]);
            $cursor = (string) ($previousNodes[$cursor] ?? $startNode);
        }

        return $this->plannerRouteUsesStoredHyperlane($edges) ? $edges : [];
    }

    protected function plannerRouteUsesStoredHyperlane(array $hopEdges): bool
    {
        foreach ($hopEdges as $edge) {
            if (($edge['hop_type'] ?? 'hyperlane') !== 'direct') {
                return true;
            }

            if (!empty($edge['lane_uid'])) {
                return true;
            }
        }

        return false;
    }

    protected function buildPlannerRouteSignature(array $hopEdges): string
    {
        $parts = [];

        foreach ($hopEdges as $edge) {
            $parts[] = implode(':', [
                (string) ($edge['hop_type'] ?? 'hyperlane'),
                (string) ($edge['lane_uid'] ?? ''),
                (string) ($edge['source_system_id'] ?? ''),
                (string) ($edge['destination_system_id'] ?? $edge['destination_node'] ?? ''),
            ]);
        }

        return implode('|', $parts);
    }

    public function searchRecords(Request $request): JsonResponse
    {
        $compact = $request->boolean('compact', false);
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);
        $scanWindow = $this->resolveScanWindow($request);
        $requestedBounds = $this->resolveRequestedBounds($request);

        if (!$canViewAsteroidIntel && !$scanWindow) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $cacheKey = $this->buildSearchRecordsCacheKey(
            $compact,
            $canViewAsteroidIntel,
            $scanWindow,
            $requestedBounds
        );
        $records = Cache::remember($cacheKey, self::SEARCH_RECORDS_CACHE_TTL_SECONDS, function () use (
            $compact,
            $scanWindow,
            $canViewAsteroidIntel,
            $requestedBounds
        ) {
            $now = Carbon::now();
            $results = [];

            foreach (
                DB::table('swc_sector_search_records')
                    ->when($scanWindow !== null && !$canViewAsteroidIntel, function ($query) use ($scanWindow) {
                        $query
                            ->whereBetween('galx', [$scanWindow['min_galx'], $scanWindow['max_galx']])
                            ->whereBetween('galy', [$scanWindow['min_galy'], $scanWindow['max_galy']]);
                    })
                    ->when($requestedBounds !== null, function ($query) use ($requestedBounds) {
                        $query
                            ->whereBetween('galx', [$requestedBounds['min_galx'], $requestedBounds['max_galx']])
                            ->whereBetween('galy', [$requestedBounds['min_galy'], $requestedBounds['max_galy']]);
                    })
                    ->orderBy('galy')
                    ->orderBy('galx')
                    ->select([
                        'id',
                        'sector_uid',
                        'asteroid_uid',
                        'galx',
                        'galy',
                        'square_name',
                        'is_system_searched',
                        'has_asteroids',
                        'planetoids_checked',
                        'planetoid_1_type',
                        'planetoid_1_size',
                        'planetoid_2_type',
                        'planetoid_2_size',
                        'has_ships',
                        'has_stations',
                        'legacy_note',
                        'legacy_recorded_at',
                        'rescan_due_at',
                        'legacy_player',
                        'legacy_icon',
                        'legacy_handle',
                        'legacy_tag',
                        'legacy_read',
                        'updated_at',
                    ])
                    ->cursor() as $record
            ) {
                $legacyRecordedAt = $record->legacy_recorded_at
                    ? Carbon::parse($record->legacy_recorded_at)->toISOString()
                    : null;
                $rescanDueAt = $record->rescan_due_at
                    ? Carbon::parse($record->rescan_due_at)->toISOString()
                    : null;
                $isRescanDue = $record->rescan_due_at
                    ? Carbon::parse($record->rescan_due_at)->lte($now)
                    : false;

                if ($compact) {
                    $flags = 0;
                    if ((bool) $record->is_system_searched) {
                        $flags |= 1;
                    }
                    if ($canViewAsteroidIntel && (bool) $record->has_asteroids) {
                        $flags |= 2;
                    }
                    if ($canViewAsteroidIntel && $record->has_ships === 1) {
                        $flags |= 4;
                    }
                    if ($canViewAsteroidIntel && $record->has_stations === 1) {
                        $flags |= 8;
                    }
                    if ($isRescanDue) {
                        $flags |= 16;
                    }
                    if ($canViewAsteroidIntel && (bool) $record->legacy_read) {
                        $flags |= 32;
                    }

                    // Compact tuple:
                    // [id, sector_uid, asteroid_uid, galx, galy, square_name, flags, p1_size, p2_size, legacy_recorded_at, rescan_due_at, handle]
                    $results[] = [
                        (int) $record->id,
                        $record->sector_uid,
                        $canViewAsteroidIntel ? $record->asteroid_uid : null,
                        (int) $record->galx,
                        (int) $record->galy,
                        $record->square_name,
                        $flags,
                        $canViewAsteroidIntel ? $record->planetoid_1_size : null,
                        $canViewAsteroidIntel ? $record->planetoid_2_size : null,
                        $legacyRecordedAt,
                        $rescanDueAt,
                        $canViewAsteroidIntel ? $record->legacy_handle : null,
                    ];
                    continue;
                }

                $results[] = [
                    'id' => (int) $record->id,
                    'sector_uid' => $record->sector_uid,
                    'asteroid_uid' => $canViewAsteroidIntel ? $record->asteroid_uid : null,
                    'galx' => (int) $record->galx,
                    'galy' => (int) $record->galy,
                    'square_name' => $record->square_name,
                    'is_system_searched' => (bool) $record->is_system_searched,
                    'has_asteroids' => $canViewAsteroidIntel ? (bool) $record->has_asteroids : false,
                    'planetoids_checked' => $canViewAsteroidIntel
                        ? ($record->planetoids_checked === null ? null : (bool) $record->planetoids_checked)
                        : null,
                    'planetoid_1_type' => $canViewAsteroidIntel ? $record->planetoid_1_type : null,
                    'planetoid_1_size' => $canViewAsteroidIntel ? $record->planetoid_1_size : null,
                    'planetoid_2_type' => $canViewAsteroidIntel ? $record->planetoid_2_type : null,
                    'planetoid_2_size' => $canViewAsteroidIntel ? $record->planetoid_2_size : null,
                    'has_ships' => $canViewAsteroidIntel ? ($record->has_ships === null ? null : (bool) $record->has_ships) : null,
                    'has_stations' => $canViewAsteroidIntel ? ($record->has_stations === null ? null : (bool) $record->has_stations) : null,
                    'legacy_note' => $canViewAsteroidIntel ? $record->legacy_note : null,
                    'legacy_recorded_at' => $legacyRecordedAt,
                    'rescan_due_at' => $rescanDueAt,
                    'is_rescan_due' => $isRescanDue,
                    'legacy_player' => $canViewAsteroidIntel ? $record->legacy_player : null,
                    'legacy_icon' => $canViewAsteroidIntel ? $record->legacy_icon : null,
                    'handle' => $canViewAsteroidIntel ? $record->legacy_handle : null,
                    'legacy_tag' => $canViewAsteroidIntel ? $record->legacy_tag : null,
                    'legacy_read' => $canViewAsteroidIntel ? (bool) $record->legacy_read : false,
                    'updated_at' => $record->updated_at
                        ? Carbon::parse($record->updated_at)->toISOString()
                        : null,
                ];
            }

            return $results;
        });

        return response()->json([
            'ok' => true,
            'data' => $records,
            'compact' => $compact,
        ]);
    }

    protected function buildSearchRecordsCacheKey(bool $compact, bool $canViewAsteroidIntel, ?array $scanWindow, ?array $requestedBounds): string
    {
        $version = (int) Cache::get(self::SEARCH_RECORDS_CACHE_VERSION_KEY, 1);

        return sprintf(
            'universe:search-records:index:v%d:%s',
            $version,
            md5(json_encode([
                'compact' => $compact,
                'can_view_asteroid_intel' => $canViewAsteroidIntel,
                'scan_window' => $scanWindow,
                'requested_bounds' => $requestedBounds,
            ], JSON_THROW_ON_ERROR))
        );
    }

    protected function serializePlannerSystem(?object $system): ?array
    {
        if (!$system) {
            return null;
        }

        return [
            'uid' => $system->uid,
            'identifier' => $system->identifier,
            'name' => $system->name,
            'sector_uid' => $system->sector_uid,
            'sector_name' => $system->sector_name,
            'galx' => $system->galx,
            'galy' => $system->galy,
        ];
    }

    protected function buildPlannerSystemEndpoint(?object $system): ?array
    {
        if (!$system) {
            return null;
        }

        return [
            'kind' => 'system',
            'system' => $system,
            'galx' => $system->galx,
            'galy' => $system->galy,
            'identifier' => $system->identifier ?: $system->uid,
            'name' => $system->name,
        ];
    }

    protected function serializePlannerEndpoint(?array $endpoint): ?array
    {
        if (!$endpoint) {
            return null;
        }

        if (($endpoint['kind'] ?? null) === 'system') {
            return [
                ...($this->serializePlannerSystem($endpoint['system'] ?? null) ?? []),
                'kind' => 'system',
                'label' => $endpoint['name'] ?? (($endpoint['system']->name ?? null) ?: ($endpoint['identifier'] ?? null)),
            ];
        }

        return [
            'uid' => null,
            'identifier' => $endpoint['identifier'] ?? null,
            'name' => $endpoint['name'] ?? null,
            'sector_uid' => null,
            'sector_name' => null,
            'galx' => $endpoint['galx'] ?? null,
            'galy' => $endpoint['galy'] ?? null,
            'kind' => 'coords',
            'label' => $endpoint['name'] ?? sprintf('%s, %s', $endpoint['galx'] ?? '?', $endpoint['galy'] ?? '?'),
        ];
    }

    protected function serializeHyperPlan(HyperPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'from_system_identifier' => $plan->from_system_identifier,
            'from_system_name' => $plan->from_system_name,
            'to_system_identifier' => $plan->to_system_identifier,
            'to_system_name' => $plan->to_system_name,
            'ship_uid' => $plan->ship_uid,
            'ship_name' => $plan->ship_name,
            'ship_class_name' => $plan->ship_class_name,
            'hyperspeed' => $plan->hyperspeed,
            'piloting_skill' => $plan->piloting_skill,
            'created_at' => $plan->created_at?->toISOString(),
            'updated_at' => $plan->updated_at?->toISOString(),
        ];
    }

    protected function resolvePlannerEndpoint(
        string $value,
        array $systemsByUid,
        array $systemsByIdentifier,
        array $systemsByName
    ): ?array {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (isset($systemsByIdentifier[$trimmed])) {
            return $this->buildPlannerSystemEndpoint($systemsByIdentifier[$trimmed]);
        }

        if (isset($systemsByUid[$trimmed])) {
            return $this->buildPlannerSystemEndpoint($systemsByUid[$trimmed]);
        }

        if (preg_match('/^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/', $trimmed, $matches)) {
            return [
                'kind' => 'coords',
                'galx' => (int) $matches[1],
                'galy' => (int) $matches[2],
                'identifier' => sprintf('%d,%d', (int) $matches[1], (int) $matches[2]),
                'name' => sprintf('%d, %d', (int) $matches[1], (int) $matches[2]),
            ];
        }

        $system = $systemsByName[$this->normalizeSystemLookupValue($trimmed)] ?? null;
        return $this->buildPlannerSystemEndpoint($system);
    }

    protected function normalizeSystemLookupValue(?string $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    protected function systemCoordKey(int|string|null $galx, int|string|null $galy): string
    {
        return sprintf('%s:%s', (string) $galx, (string) $galy);
    }

    protected function calculatePlannerJourneyLength(
        int|string|null $startX,
        int|string|null $startY,
        int|string|null $endX,
        int|string|null $endY
    ): int {
        return max(
            abs((int) $endX - (int) $startX),
            abs((int) $endY - (int) $startY)
        );
    }

    protected function calculatePlannerDirectTravelSeconds(
        int $journeyLength,
        int $pilotingSkill,
        int $hyperspeed
    ): int {
        if ($journeyLength <= 0) {
            return 0;
        }

        $shipSpeed = 1.0;
        $speedWithPiloting = $shipSpeed * (1 + ($pilotingSkill * 0.05));
        $intervalInSeconds = (int) floor(7200 / $speedWithPiloting);
        $hyperspeedModifier = 1 / max(1, $hyperspeed);

        return (int) ceil(ceil($journeyLength * $intervalInSeconds) * $hyperspeedModifier);
    }

    protected function calculatePlannerTimeModifier(
        float $speedLimit,
        int $journeyLength,
        int $blocksUsed
    ): float {
        $safeLength = max(1, $journeyLength);
        $y0 = 2 - $speedLimit;
        $l = 2 - (2 * $speedLimit);
        $k = (-0.00023 * log($safeLength)) + 0.0017;

        return $y0 - ($l / (1 + exp(-$k * $blocksUsed)));
    }

    protected function normalizePlannerStoredModifier(float $storedModifier): float
    {
        if ($storedModifier <= -1.0 || $storedModifier >= 2.0) {
            return max(0.01, 1 + ($storedModifier / 100));
        }

        if ($storedModifier < 0) {
            return max(0.01, 1 + $storedModifier);
        }

        return max(0.01, $storedModifier);
    }

    protected function formatPlannerTime(int|float $totalSeconds): string
    {
        if ($totalSeconds < 1) {
            return 'Less than a second';
        }

        $seconds = (int) floor($totalSeconds % 60);
        $minutes = (int) floor(($totalSeconds % 3600) / 60);
        $hours = (int) floor(($totalSeconds % 86400) / 3600);
        $days = (int) floor($totalSeconds / 86400);

        $parts = [];

        if ($days > 0) {
            $parts[] = sprintf('%d Day%s', $days, $days === 1 ? '' : 's');
        }

        if ($hours > 0 || $days > 0) {
            $parts[] = sprintf('%d Hour%s', $hours, $hours === 1 ? '' : 's');
        }

        if ($minutes > 0 || $hours > 0 || $days > 0) {
            $parts[] = sprintf('%d Minute%s', $minutes, $minutes === 1 ? '' : 's');
        }

        $parts[] = sprintf('%d Second%s', $seconds, $seconds === 1 ? '' : 's');

        return implode(', ', $parts);
    }

    protected function toPlannerInt(mixed $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        return (int) round((float) $value);
    }

    public function sector(Request $request, string $sector): JsonResponse
    {
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);

        $sectorRecord = SwcSector::query()
            ->where('uid', $sector)
            ->orWhere('name', $sector)
            ->firstOrFail();

        $systems = SwcSystem::query()
            ->where('sector_id', $sectorRecord->id)
            ->orderBy('name')
            ->get([
                'uid',
                'identifier',
                'name',
                'sector_uid',
                'sector_name',
                'owner_uid',
                'owner_name',
                'galx',
                'galy',
                'sysx',
                'sysy',
                'last_pulled_at',
            ]);

        $outlineCoordinates = $this->normalizeSectorCoordinates($sectorRecord->outline_coordinates ?? []);
        $sectorCellKeys = $this->buildSectorCellKeys($outlineCoordinates, is_array($sectorRecord->bounds) ? $sectorRecord->bounds : null);
        $sectorCoordinates = $this->sectorCellCoordinatesFromKeys($sectorCellKeys);

        $annotationsQuery = SwcSectorCellAnnotation::query()->whereNull('owner_user_id');
        if (is_array($sectorRecord->bounds)) {
            $bounds = $sectorRecord->bounds;
            if (
                isset($bounds['min_galx'], $bounds['max_galx'], $bounds['min_galy'], $bounds['max_galy']) &&
                is_numeric($bounds['min_galx']) &&
                is_numeric($bounds['max_galx']) &&
                is_numeric($bounds['min_galy']) &&
                is_numeric($bounds['max_galy'])
            ) {
                $annotationsQuery->whereBetween('galx', [(int) $bounds['min_galx'], (int) $bounds['max_galx']])
                    ->whereBetween('galy', [(int) $bounds['min_galy'], (int) $bounds['max_galy']]);
            } else {
                $annotationsQuery->where('sector_uid', $sectorRecord->uid);
            }
        } else {
            $annotationsQuery->where('sector_uid', $sectorRecord->uid);
        }

        $annotations = $canViewAsteroidIntel
            ? $annotationsQuery
                ->orderBy('galy')
                ->orderBy('galx')
                ->get([
                    'id',
                    'sector_uid',
                    'galx',
                    'galy',
                    'marker_type',
                    'label',
                    'notes',
                    'updated_at',
                ])
                ->filter(function (SwcSectorCellAnnotation $annotation) use ($sectorCellKeys, $sectorRecord) {
                    if ($annotation->sector_uid === $sectorRecord->uid) {
                        return true;
                    }

                    return isset($sectorCellKeys[sprintf('%d:%d', $annotation->galx, $annotation->galy)]);
                })
                ->values()
            : collect();

        $searchRecordsQuery = SwcSectorSearchRecord::query();
        if (is_array($sectorRecord->bounds)) {
            $bounds = $sectorRecord->bounds;
            if (
                isset($bounds['min_galx'], $bounds['max_galx'], $bounds['min_galy'], $bounds['max_galy']) &&
                is_numeric($bounds['min_galx']) &&
                is_numeric($bounds['max_galx']) &&
                is_numeric($bounds['min_galy']) &&
                is_numeric($bounds['max_galy'])
            ) {
                $searchRecordsQuery->whereBetween('galx', [(int) $bounds['min_galx'], (int) $bounds['max_galx']])
                    ->whereBetween('galy', [(int) $bounds['min_galy'], (int) $bounds['max_galy']]);
            } else {
                $searchRecordsQuery->where('sector_uid', $sectorRecord->uid);
            }
        } else {
            $searchRecordsQuery->where('sector_uid', $sectorRecord->uid);
        }

        $searchRecords = $canViewAsteroidIntel
            ? $searchRecordsQuery
                ->orderBy('galy')
                ->orderBy('galx')
                ->get([
                    'id',
                    'sector_uid',
                    'asteroid_uid',
                    'galx',
                    'galy',
                    'square_name',
                    'is_system_searched',
                    'has_asteroids',
                    'planetoids_checked',
                    'planetoid_1_type',
                    'planetoid_1_size',
                    'planetoid_2_type',
                    'planetoid_2_size',
                    'has_ships',
                    'has_stations',
                    'legacy_note',
                    'legacy_recorded_at',
                    'rescan_due_at',
                    'legacy_player',
                    'legacy_icon',
                    'legacy_handle',
                    'legacy_tag',
                    'legacy_read',
                    'updated_at',
                ])
                ->map(fn (SwcSectorSearchRecord $record) => $this->mapSearchRecord($record))
                ->filter(function (array $record) use ($sectorCellKeys, $sectorRecord) {
                    if ($record['sector_uid'] === $sectorRecord->uid) {
                        return true;
                    }

                    return isset($sectorCellKeys[sprintf('%d:%d', $record['galx'], $record['galy'])]);
                })
                ->values()
            : collect();

        return response()->json([
            'ok' => true,
            'data' => [
                'resource' => 'sector',
                'identifier' => $sectorRecord->uid,
                'sector' => [
                    'uid' => $sectorRecord->uid,
                    'name' => $sectorRecord->name,
                    'owner_uid' => $sectorRecord->owner_uid,
                    'owner_name' => $sectorRecord->owner_name,
                    'population' => $sectorRecord->population,
                    'known_systems' => $sectorRecord->known_systems,
                    'coordinate_count' => $sectorRecord->coordinate_count,
                    'system_count' => $sectorRecord->system_count,
                    'color_r' => $sectorRecord->color_r,
                    'color_g' => $sectorRecord->color_g,
                    'color_b' => $sectorRecord->color_b,
                    'color_hex' => $sectorRecord->color_hex,
                ],
                'outline_coordinates' => $outlineCoordinates,
                'coordinates' => $sectorCoordinates,
                'bounds' => $sectorRecord->bounds,
                'systems' => $systems,
                'annotations' => $annotations,
                'search_records' => $searchRecords,
            ],
        ]);
    }

    public function location(Request $request, int $galx, int $galy): JsonResponse
    {
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);
        $scanWindow = $this->resolveScanWindow($request);
        $canViewDroidBrainShips = Permissions::hasAny(
            $request->user(),
            ['is_intel', 'is_sysadmin']
        );

        $isWithinScanWindow = $scanWindow !== null
            && $galx >= $scanWindow['min_galx']
            && $galx <= $scanWindow['max_galx']
            && $galy >= $scanWindow['min_galy']
            && $galy <= $scanWindow['max_galy'];

        $canViewSearchRecord = $canViewAsteroidIntel || $isWithinScanWindow;

        $systems = SwcSystem::query()
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->orderBy('name')
            ->get([
                'uid',
                'identifier',
                'name',
                'sector_uid',
                'sector_name',
                'owner_uid',
                'owner_name',
                'galx',
                'galy',
                'last_pulled_at',
            ]);

        $searchRecord = $canViewSearchRecord
            ? SwcSectorSearchRecord::query()
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->orderByDesc('updated_at')
                ->first()
            : null;

        $annotation = $canViewAsteroidIntel
            ? SwcSectorCellAnnotation::query()
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->orderByDesc('updated_at')
                ->first([
                    'id',
                    'sector_uid',
                    'galx',
                    'galy',
                    'marker_type',
                    'label',
                    'notes',
                    'updated_at',
                ])
            : null;

        $ships = $canViewDroidBrainShips
            ? DB::table('droidbrain_ships_latest')
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->orderBy('sysy')
                ->orderBy('sysx')
                ->orderBy('name')
                ->get([
                    'entity_uid',
                    'name',
                    'owner_uid',
                    'owner_name',
                    'class_name',
                    'type_name',
                    'system_name',
                    'planet_name',
                    'city_name',
                    'sysx',
                    'sysy',
                    'surfx',
                    'surfy',
                    'groundx',
                    'groundy',
                    'snapshot_unixtime',
                ])
                ->map(fn ($ship) => [
                    'uid' => $ship->entity_uid,
                    'name' => $ship->name,
                    'owner_uid' => $ship->owner_uid,
                    'owner_name' => $ship->owner_name,
                    'class_name' => $ship->class_name,
                    'type_name' => $ship->type_name,
                    'system_name' => $ship->system_name,
                    'planet_name' => $ship->planet_name,
                    'city_name' => $ship->city_name,
                    'sysx' => $ship->sysx,
                    'sysy' => $ship->sysy,
                    'surfx' => $ship->surfx,
                    'surfy' => $ship->surfy,
                    'groundx' => $ship->groundx,
                    'groundy' => $ship->groundy,
                    'snapshot_unixtime' => $ship->snapshot_unixtime,
                ])
                ->values()
            : collect();

        $stations = $canViewDroidBrainShips
            ? tap(
                DB::table('droidbrain_stations_latest')
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->orderBy('sysy')
                ->orderBy('sysx')
                ->orderBy('name')
                ->get([
                    'entity_uid',
                    'name',
                    'owner_uid',
                    'owner_name',
                    'type_name',
                    'system_name',
                    'planet_name',
                    'sysx',
                    'sysy',
                    'surfx',
                    'surfy',
                    'snapshot_unixtime',
                ]),
                function ($stationRows) {
                }
            )
                ->pipe(function ($stationRows) {
                    $stationTypesByName = $stationRows->pluck('type_name')
                        ->filter(fn ($value) => is_string($value) && trim($value) !== '')
                        ->unique()
                        ->isEmpty()
                        ? collect()
                        : SwcStationType::query()
                            ->whereIn('name', $stationRows->pluck('type_name')->filter()->unique()->values())
                            ->get(['name', 'image_url', 'icon_url'])
                            ->keyBy('name');

                    return $stationRows->map(fn ($station) => [
                    'uid' => $station->entity_uid,
                    'name' => $station->name,
                    'owner_uid' => $station->owner_uid,
                    'owner_name' => $station->owner_name,
                    'class_name' => null,
                    'type_name' => $station->type_name,
                    'image_url' => optional($stationTypesByName->get($station->type_name))->image_url,
                    'icon_url' => optional($stationTypesByName->get($station->type_name))->icon_url,
                    'system_name' => $station->system_name,
                    'planet_name' => $station->planet_name,
                    'city_name' => null,
                    'sysx' => $station->sysx,
                    'sysy' => $station->sysy,
                    'surfx' => $station->surfx,
                    'surfy' => $station->surfy,
                    'groundx' => null,
                    'groundy' => null,
                    'snapshot_unixtime' => $station->snapshot_unixtime,
                    ])->values();
                })
            : collect();
        $asteroidField = $canViewSearchRecord
            ? $this->resolveLocationAsteroidField($galx, $galy)
            : null;

        $primarySystem = $systems->first();
        $sectorUid = $searchRecord?->sector_uid
            ?? $annotation?->sector_uid
            ?? $primarySystem?->sector_uid;
        $sectorName = $primarySystem?->sector_name
            ?? ($sectorUid
                ? SwcSector::query()->where('uid', $sectorUid)->value('name')
                : null);

        $primaryLabel = $primarySystem?->name
            ?? $searchRecord?->square_name
            ?? ($searchRecord?->has_asteroids ? 'Asteroid Cell' : null)
            ?? 'Deep Space';

        return response()->json([
            'ok' => true,
            'data' => [
                'resource' => 'location',
                'location' => [
                    'galx' => $galx,
                    'galy' => $galy,
                    'primary_label' => $primaryLabel,
                    'sector_uid' => $sectorUid,
                    'sector_name' => $sectorName,
                    'within_scan_window' => $isWithinScanWindow,
                ],
                'systems' => $systems->map(fn (SwcSystem $systemRecord) => [
                    'uid' => $systemRecord->uid,
                    'identifier' => $systemRecord->identifier,
                    'name' => $systemRecord->name,
                    'sector_uid' => $systemRecord->sector_uid,
                    'sector_name' => $systemRecord->sector_name,
                    'owner_uid' => $systemRecord->owner_uid,
                    'owner_name' => $systemRecord->owner_name,
                    'galx' => $systemRecord->galx,
                    'galy' => $systemRecord->galy,
                    'last_pulled_at' => $systemRecord->last_pulled_at,
                ])->values(),
                'search_record' => $searchRecord
                    ? $this->mapSearchRecord($searchRecord)
                    : null,
                'annotation' => $annotation ? [
                    'id' => $annotation->id,
                    'sector_uid' => $annotation->sector_uid,
                    'galx' => $annotation->galx,
                    'galy' => $annotation->galy,
                    'marker_type' => $annotation->marker_type,
                    'label' => $annotation->label,
                    'notes' => $annotation->notes,
                    'updated_at' => $annotation->updated_at?->toISOString(),
                ] : null,
                'asteroid_field' => $asteroidField,
                'ships' => $ships,
                'stations' => $stations,
            ],
        ]);
    }

    public function system(Request $request, string $system): JsonResponse
    {
        $isFullTier = $this->toolAccessService->tierForUser($request->user()) === ToolAccessService::TIER_FULL;
        $canViewPreviousPopulation = $isFullTier && Permissions::hasAny(
            $request->user(),
            ['is_intel', 'is_admin']
        );
        $canViewDroidBrainShips = Permissions::hasAny(
            $request->user(),
            ['is_intel', 'is_sysadmin']
        );
        $canViewTerrainData = Permissions::hasAny(
            $request->user(),
            ['is_intel', 'is_admin', 'is_sysadmin']
        );

        $systemRecord = SwcSystem::query()->where('uid', $system)->first()
            ?? SwcSystem::query()->where('identifier', $system)->first()
            ?? SwcSystem::query()->where('name', $system)->firstOrFail();

        $planetColumns = [
            'uid', 'identifier', 'name', 'owner_uid', 'owner_name',
            'planet_type_uid', 'planet_type_name', 'planet_type_href',
            'size', 'population', 'previous_population', 'previous_population_recorded_at',
            'galx', 'galy', 'sysx', 'sysy',
            'image_small_url', 'image_large_url', 'image_atmosphere_url',
            'image_stratosphere_url', 'image_loworbit_url', 'last_pulled_at',
        ];
        if ($canViewTerrainData) {
            $planetColumns = array_merge($planetColumns, ['terrain_map', 'surface_bounds', 'terrain_grid', 'cities']);
        }
        $planets = SwcPlanet::query()
            ->where('system_id', $systemRecord->id)
            ->orderBy('name')
            ->get($planetColumns);

        $stations = SwcStation::query()
            ->with('stationType')
            ->where('system_id', $systemRecord->id)
            ->orderBy('name')
            ->get([
                'station_type_id',
                'uid',
                'identifier',
                'name',
                'type_name',
                'owner_uid',
                'owner_name',
                'galx',
                'galy',
                'sysx',
                'sysy',
                'last_pulled_at',
            ]);

        $stationTypeNames = $stations
            ->filter(fn (SwcStation $station) => $station->stationType === null)
            ->pluck('type_name')
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn (string $value) => trim($value))
            ->unique()
            ->values();

        $stationTypesByName = $stationTypeNames->isEmpty()
            ? collect()
            : SwcStationType::query()
                ->whereIn('name', $stationTypeNames)
                ->get([
                    'uid',
                    'name',
                    'category',
                    'class_name',
                    'size',
                    'length',
                    'width',
                    'height',
                    'description',
                    'image_url',
                    'last_pulled_at',
                ])
                ->keyBy('name');

        $hyperlanes = SwcHyperlane::query()
            ->where('source_system_id', $systemRecord->id)
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'destination_uid',
                'destination_name',
                'destination_galx',
                'destination_galy',
                'owner_name',
                'blocks',
                'modifier',
                'last_pulled_at',
            ]);

        $ships = $canViewDroidBrainShips
            ? DB::table('droidbrain_ships_latest')
                ->where('galx', $systemRecord->galx)
                ->where('galy', $systemRecord->galy)
                ->whereNotNull('sysx')
                ->whereNotNull('sysy')
                ->orderBy('name')
                ->get([
                    'entity_uid',
                    'name',
                    'owner_uid',
                    'owner_name',
                    'class_name',
                    'type_name',
                    'galx',
                    'galy',
                    'sysx',
                    'sysy',
                    'snapshot_unixtime',
                ])
                ->map(fn ($ship) => [
                    'uid' => $ship->entity_uid,
                    'name' => $ship->name,
                    'owner_uid' => $ship->owner_uid,
                    'owner_name' => $ship->owner_name,
                    'class_name' => $ship->class_name,
                    'type_name' => $ship->type_name,
                    'galx' => $ship->galx,
                    'galy' => $ship->galy,
                    'sysx' => $ship->sysx,
                    'sysy' => $ship->sysy,
                    'snapshot_unixtime' => $ship->snapshot_unixtime,
                ])
                ->values()
            : collect();

        $droidbrainStationRows = $canViewDroidBrainShips
            ? DB::table('droidbrain_stations_latest')
                ->where('galx', $systemRecord->galx)
                ->where('galy', $systemRecord->galy)
                ->whereNotNull('sysx')
                ->whereNotNull('sysy')
                ->orderBy('name')
                ->get([
                    'entity_uid',
                    'name',
                    'owner_uid',
                    'owner_name',
                    'type_name',
                    'galx',
                    'galy',
                    'sysx',
                    'sysy',
                    'snapshot_unixtime',
                ])
            : collect();

        $droidbrainStationTypeNames = $droidbrainStationRows
            ->pluck('type_name')
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn (string $value) => trim($value))
            ->unique()
            ->values();

        $droidbrainStationTypesByName = $droidbrainStationTypeNames->isEmpty()
            ? collect()
            : SwcStationType::query()
                ->whereIn('name', $droidbrainStationTypeNames)
                ->get(['name', 'image_url', 'icon_url'])
                ->keyBy('name');

        $droidbrainStations = $droidbrainStationRows
            ->map(function ($station) use ($droidbrainStationTypesByName) {
                $stationType = $droidbrainStationTypesByName->get($station->type_name);

                return [
                    'uid' => $station->entity_uid,
                    'name' => $station->name,
                    'owner_uid' => $station->owner_uid,
                    'owner_name' => $station->owner_name,
                    'type_name' => $station->type_name,
                    'galx' => $station->galx,
                    'galy' => $station->galy,
                    'sysx' => $station->sysx,
                    'sysy' => $station->sysy,
                    'snapshot_unixtime' => $station->snapshot_unixtime,
                    'image_url' => $stationType?->image_url,
                    'icon_url' => $stationType?->icon_url,
                ];
            })
            ->values();

        return response()->json([
            'ok' => true,
            'data' => [
                'resource' => 'system',
                'identifier' => $systemRecord->identifier ?: $systemRecord->uid,
                'system' => [
                    'uid' => $systemRecord->uid,
                    'identifier' => $systemRecord->identifier,
                    'name' => $systemRecord->name,
                    'sector_uid' => $systemRecord->sector_uid,
                    'sector_name' => $systemRecord->sector_name,
                    'owner_uid' => $systemRecord->owner_uid,
                    'owner_name' => $systemRecord->owner_name,
                    'galx' => $systemRecord->galx,
                    'galy' => $systemRecord->galy,
                    'sysx' => $systemRecord->sysx,
                    'sysy' => $systemRecord->sysy,
                    'last_pulled_at' => $systemRecord->last_pulled_at,
                ],
                'planets' => $planets->map(function (SwcPlanet $planet) use ($isFullTier, $canViewPreviousPopulation, $canViewTerrainData) {
                    return [
                        'uid' => $planet->uid,
                        'identifier' => $planet->identifier,
                        'name' => $planet->name,
                        'owner_uid' => $planet->owner_uid,
                        'owner_name' => $planet->owner_name,
                        'planet_type_uid' => $planet->planet_type_uid,
                        'planet_type_name' => $planet->planet_type_name,
                        'planet_type_href' => $planet->planet_type_href,
                        'size' => $planet->size,
                        'population' => $isFullTier ? $planet->population : null,
                        'previous_population' => $canViewPreviousPopulation ? $planet->previous_population : null,
                        'previous_population_recorded_at' => $canViewPreviousPopulation ? $planet->previous_population_recorded_at : null,
                        'galx' => $planet->galx,
                        'galy' => $planet->galy,
                        'sysx' => $planet->sysx,
                        'sysy' => $planet->sysy,
                        'terrain_map' => $canViewTerrainData ? $planet->terrain_map : null,
                        'surface_bounds' => $canViewTerrainData ? $planet->surface_bounds : null,
                        'terrain_grid' => $canViewTerrainData ? $planet->terrain_grid : null,
                        'cities' => $canViewTerrainData ? $planet->cities : null,
                        'image_small_url' => $planet->image_small_url,
                        'image_large_url' => $planet->image_large_url,
                        'image_atmosphere_url' => $planet->image_atmosphere_url,
                        'image_stratosphere_url' => $planet->image_stratosphere_url,
                        'image_loworbit_url' => $planet->image_loworbit_url,
                        'last_pulled_at' => $planet->last_pulled_at,
                    ];
                })->values(),
                'stations' => $stations->map(function (SwcStation $station) use ($stationTypesByName) {
                    $type = $station->stationType;

                    if (!$type && $station->type_name) {
                        $type = $stationTypesByName->get($station->type_name);
                    }

                    return [
                        'uid' => $station->uid,
                        'identifier' => $station->identifier,
                        'name' => $station->name,
                        'type_name' => $station->type_name,
                        'owner_uid' => $station->owner_uid,
                        'owner_name' => $station->owner_name,
                        'galx' => $station->galx,
                        'galy' => $station->galy,
                        'sysx' => $station->sysx,
                        'sysy' => $station->sysy,
                        'last_pulled_at' => $station->last_pulled_at,
                        'station_type' => $type ? [
                            'uid' => $type->uid,
                            'name' => $type->name,
                            'length' => $type->length,
                            'description' => $type->description,
                            'sensors' => $type->sensors,
                            'ecm' => $type->ecm,
                            'weight_tonnes' => $type->weight_tonnes,
                            'volume_m3' => $type->volume_m3,
                            'weight_capacity_tonnes' => $type->weight_capacity_tonnes,
                            'volume_capacity_m3' => $type->volume_capacity_m3,
                            'max_passengers' => $type->max_passengers,
                            'escape_pods' => $type->escape_pods,
                            'hull' => $type->hull,
                            'shield' => $type->shield,
                            'ionic_capacity' => $type->ionic_capacity,
                            'medical_rooms' => $type->medical_rooms,
                            'has_hangar_bay' => $type->has_hangar_bay,
                            'has_docking_bay' => $type->has_docking_bay,
                            'can_recycle' => $type->can_recycle,
                            'can_produce' => $type->can_produce,
                            'is_asteroid_mining_depot' => $type->is_asteroid_mining_depot,
                            'can_refine_alazhi' => $type->can_refine_alazhi,
                            'can_interdict' => $type->can_interdict,
                            'can_research' => $type->can_research,
                            'price_credits' => $type->price_credits,
                            'production_modifier' => $type->production_modifier,
                            'recommended_workers' => $type->recommended_workers,
                            'recycling_xp' => $type->recycling_xp,
                            'generic_slots' => $type->generic_slots,
                            'weapons' => $type->weapons,
                            'materials' => $type->materials,
                            'images' => $type->images,
                            'image_url' => $type->image_url,
                            'icon_url' => $type->icon_url,
                            'last_pulled_at' => $type->last_pulled_at,
                        ] : null,
                    ];
                })->values(),
                'droidbrain_stations' => $droidbrainStations,
                'hyperlanes' => $hyperlanes,
                'ships' => $ships,
            ],
        ]);
    }

    public function stationTypes(): JsonResponse
    {
        return $this->cachedListResponse('universe:types:station', 300, fn () => SwcStationType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'length',
                'description',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_passengers',
                'escape_pods',
                'hull',
                'shield',
                'ionic_capacity',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_produce',
                'is_asteroid_mining_depot',
                'can_refine_alazhi',
                'can_interdict',
                'can_research',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ])->toArray());
    }

    public function shipTypes(): JsonResponse
    {
        return $this->cachedListResponse('universe:types:ship', 300, fn () => SwcShipType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'length',
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_speed',
                'hyperdrive',
                'max_passengers',
                'escape_pods',
                'hull',
                'shield',
                'shield_arcs',
                'armour',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_interdict',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ])->toArray());
    }

    public function vehicleTypes(): JsonResponse
    {
        $types = SwcVehicleType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'length',
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_speed',
                'max_passengers',
                'hull',
                'shield',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'terrain_restrictions',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function npcTypes(): JsonResponse
    {
        $types = SwcNpcType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'price_credits',
                'hiring_locations',
                'skills',
                'images',
                'image_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function droidTypes(): JsonResponse
    {
        $types = SwcDroidType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'sensors',
                'ecm',
                'batch_quantity',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'hull',
                'shield',
                'ionic_capacity',
                'armour',
                'slot_size',
                'terrain_restrictions',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'skills',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function creatureTypes(): JsonResponse
    {
        $types = SwcCreatureType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'slot_size',
                'species',
                'base_hp',
                'weight_tonnes',
                'volume_m3',
                'homeworld_uid',
                'homeworld_name',
                'homeworld_href',
                'spawn_terrain_types',
                'terrain_restrictions',
                'skills',
                'weapons',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function races(): JsonResponse
    {
        $types = SwcRace::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'description',
                'force_probability',
                'hp_bonus',
                'hp_multiplier',
                'homeworld_uid',
                'homeworld_name',
                'homeworld_href',
                'skills',
                'terrain_restrictions',
                'images',
                'image_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function weaponTypes(): JsonResponse
    {
        return $this->cachedListResponse('universe:types:weapon', 300, fn () => SwcWeaponType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'damage_type',
                'min_damage',
                'max_damage',
                'optimum_range',
                'max_hits',
                'drop_off',
                'firepower',
                'tracking',
                'is_poison',
                'is_dual',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ])->toArray());
    }

    public function facilityTypes(): JsonResponse
    {
        return $this->cachedListResponse('universe:types:facility', 300, fn () => SwcFacilityType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'size',
                'length',
                'width',
                'height',
                'description',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ])->toArray());
    }

    public function facilityType(string $facilityType): JsonResponse
    {
        $type = SwcFacilityType::query()
            ->where('uid', $facilityType)
            ->orWhere('name', $facilityType)
            ->firstOrFail([
                'uid',
                'name',
                'class_uid',
                'class_name',
                'size',
                'sensors',
                'weight_tonnes',
                'volume_m3',
                'volume_capacity_m3',
                'max_passengers',
                'flat_count',
                'job_count',
                'size_x',
                'size_y',
                'length',
                'width',
                'height',
                'hull',
                'shield',
                'ionic_capacity',
                'energy',
                'can_load_materials',
                'can_earn_income',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_produce',
                'can_mine',
                'can_refine_alazhi',
                'can_farm_alazhi',
                'can_research',
                'description',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function itemTypes(): JsonResponse
    {
        return $this->cachedListResponse('universe:types:item', 300, fn () => SwcItemType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_uid',
                'class_name',
                'description',
                'weight_tonnes',
                'volume_m3',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ])->toArray());
    }

    public function itemType(string $itemType): JsonResponse
    {
        $type = SwcItemType::query()
            ->where('uid', $itemType)
            ->orWhere('name', $itemType)
            ->firstOrFail([
                'uid',
                'name',
                'class_uid',
                'class_name',
                'description',
                'weight_tonnes',
                'volume_m3',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        $matchingWeapon = SwcWeaponType::query()
            ->where('uid', $type->uid)
            ->orWhere('name', $type->name)
            ->first([
                'uid',
                'name',
                'class_name',
                'description',
                'damage_type',
                'min_damage',
                'max_damage',
                'optimum_range',
                'max_hits',
                'drop_off',
                'firepower',
                'tracking',
                'is_poison',
                'is_dual',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => array_merge($type->toArray(), [
                'matching_weapon' => $matchingWeapon?->toArray(),
            ]),
        ]);
    }

    public function shipType(string $shipType): JsonResponse
    {
        $type = SwcShipType::query()
            ->where('uid', $shipType)
            ->orWhere('name', $shipType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'length',
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_speed',
                'hyperdrive',
                'max_passengers',
                'escape_pods',
                'hull',
                'shield',
                'shield_arcs',
                'armour',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_interdict',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function vehicleType(string $vehicleType): JsonResponse
    {
        $type = SwcVehicleType::query()
            ->where('uid', $vehicleType)
            ->orWhere('name', $vehicleType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'length',
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_speed',
                'max_passengers',
                'hull',
                'shield',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'terrain_restrictions',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function npcType(string $npcType): JsonResponse
    {
        $type = SwcNpcType::query()
            ->where('uid', $npcType)
            ->orWhere('name', $npcType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'price_credits',
                'hiring_locations',
                'skills',
                'images',
                'image_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function droidType(string $droidType): JsonResponse
    {
        $type = SwcDroidType::query()
            ->where('uid', $droidType)
            ->orWhere('name', $droidType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'sensors',
                'ecm',
                'batch_quantity',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'hull',
                'shield',
                'ionic_capacity',
                'armour',
                'slot_size',
                'terrain_restrictions',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'skills',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function race(string $race): JsonResponse
    {
        $type = SwcRace::query()
            ->where('uid', $race)
            ->orWhere('name', $race)
            ->firstOrFail([
                'uid',
                'name',
                'description',
                'force_probability',
                'hp_bonus',
                'hp_multiplier',
                'homeworld_uid',
                'homeworld_name',
                'homeworld_href',
                'skills',
                'terrain_restrictions',
                'images',
                'image_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function weaponType(string $weaponType): JsonResponse
    {
        $type = SwcWeaponType::query()
            ->where('uid', $weaponType)
            ->orWhere('name', $weaponType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'damage_type',
                'min_damage',
                'max_damage',
                'optimum_range',
                'max_hits',
                'drop_off',
                'firepower',
                'tracking',
                'is_poison',
                'is_dual',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        $mountedShips = SwcShipType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'image_url',
                'icon_url',
                'weapons',
            ])
            ->filter(fn (SwcShipType $ship) => $this->typeMountsWeapon($ship->weapons, $type->uid, $type->name))
            ->map(fn (SwcShipType $ship) => [
                'uid' => $ship->uid,
                'name' => $ship->name,
                'class_name' => $ship->class_name,
                'image_url' => $ship->image_url,
                'icon_url' => $ship->icon_url,
            ])
            ->values();

        $mountedVehicles = SwcVehicleType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'image_url',
                'icon_url',
                'weapons',
            ])
            ->filter(fn (SwcVehicleType $vehicle) => $this->typeMountsWeapon($vehicle->weapons, $type->uid, $type->name))
            ->map(fn (SwcVehicleType $vehicle) => [
                'uid' => $vehicle->uid,
                'name' => $vehicle->name,
                'class_name' => $vehicle->class_name,
                'image_url' => $vehicle->image_url,
                'icon_url' => $vehicle->icon_url,
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'data' => array_merge($type->toArray(), [
                'mounted_ships' => $mountedShips,
                'mounted_vehicles' => $mountedVehicles,
            ]),
        ]);
    }

    /**
     * @param  mixed  $weapons
     */
    private function typeMountsWeapon($weapons, ?string $weaponUid, ?string $weaponName): bool
    {
        if (! is_array($weapons) || $weapons === []) {
            return false;
        }

        foreach ($weapons as $weapon) {
            if (! is_array($weapon)) {
                continue;
            }

            $mountedUid = isset($weapon['uid']) ? trim((string) $weapon['uid']) : null;
            $mountedName = isset($weapon['name']) ? trim((string) $weapon['name']) : null;

            if ($weaponUid !== null && $mountedUid === $weaponUid) {
                return true;
            }

            if ($weaponName !== null && $mountedName === $weaponName) {
                return true;
            }
        }

        return false;
    }

    public function creatureType(string $creatureType): JsonResponse
    {
        $type = SwcCreatureType::query()
            ->where('uid', $creatureType)
            ->orWhere('name', $creatureType)
            ->firstOrFail([
                'uid',
                'name',
                'class_name',
                'description',
                'slot_size',
                'species',
                'base_hp',
                'weight_tonnes',
                'volume_m3',
                'homeworld_uid',
                'homeworld_name',
                'homeworld_href',
                'spawn_terrain_types',
                'terrain_restrictions',
                'skills',
                'weapons',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function stationType(string $stationType): JsonResponse
    {
        $type = SwcStationType::query()
            ->where('uid', $stationType)
            ->orWhere('name', $stationType)
            ->firstOrFail([
                'uid',
                'name',
                'length',
                'description',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'max_passengers',
                'escape_pods',
                'hull',
                'shield',
                'ionic_capacity',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_produce',
                'is_asteroid_mining_depot',
                'can_refine_alazhi',
                'can_interdict',
                'can_research',
                'price_credits',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function terrainTypes(): JsonResponse
    {
        $types = SwcTerrainType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'code',
                'material_probability_percent',
                'material_types',
                'images',
                'description',
                'image_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function planetTypes(): JsonResponse
    {
        $types = SwcPlanetType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'description',
                'images',
                'image_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function planetType(string $planetType): JsonResponse
    {
        $type = SwcPlanetType::query()
            ->where('uid', $planetType)
            ->orWhere('name', $planetType)
            ->firstOrFail([
                'uid',
                'name',
                'description',
                'images',
                'image_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function terrainType(string $terrainType): JsonResponse
    {
        $type = SwcTerrainType::query()
            ->where('uid', $terrainType)
            ->orWhere('name', $terrainType)
            ->orWhere('code', $terrainType)
            ->firstOrFail([
                'uid',
                'name',
                'code',
                'material_probability_percent',
                'material_types',
                'images',
                'description',
                'image_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }

    public function materialTypes(): JsonResponse
    {
        $types = SwcMaterialType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'description',
                'weight_tonnes',
                'volume_m3',
                'rarity',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function materialType(string $materialType): JsonResponse
    {
        $type = SwcMaterialType::query()
            ->where('uid', $materialType)
            ->orWhere('name', $materialType)
            ->firstOrFail([
                'uid',
                'name',
                'description',
                'weight_tonnes',
                'volume_m3',
                'rarity',
                'price_credits',
                'images',
                'image_url',
                'icon_url',
                'payload',
                'last_pulled_at',
            ]);

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
    }
}
