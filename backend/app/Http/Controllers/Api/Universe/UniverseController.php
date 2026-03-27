<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SwcFacilityType;
use App\Models\SwcHyperlane;
use App\Models\SwcItemType;
use App\Models\SwcMaterialType;
use App\Models\SwcPlanet;
use App\Models\SwcPlanetType;
use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use App\Models\SwcSectorSearchRecord;
use App\Models\SwcShipType;
use App\Models\SwcStation;
use App\Models\SwcStationType;
use App\Models\SwcTerrainType;
use App\Models\SwcSystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class UniverseController extends Controller
{
    private function mapSearchRecord(SwcSectorSearchRecord $record): array
    {
        return [
            'id' => $record->id,
            'sector_uid' => $record->sector_uid,
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
            'legacy_player' => $record->legacy_player,
            'legacy_icon' => $record->legacy_icon,
            'handle' => $record->legacy_handle,
            'legacy_tag' => $record->legacy_tag,
            'legacy_read' => $record->legacy_read,
            'updated_at' => $record->updated_at?->toISOString(),
        ];
    }

    public function sectors(): JsonResponse
    {
        $sectors = SwcSector::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $sectors,
        ]);
    }

    public function mapSystems(): JsonResponse
    {
        $systems = SwcSystem::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $systems,
        ]);
    }

    public function searchRecords(): JsonResponse
    {
        $now = Carbon::now();
        $records = [];

        foreach (
            DB::table('swc_sector_search_records')
                ->orderBy('galy')
                ->orderBy('galx')
                ->select([
                    'id',
                    'sector_uid',
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

            $records[] = [
                'id' => (int) $record->id,
                'sector_uid' => $record->sector_uid,
                'galx' => (int) $record->galx,
                'galy' => (int) $record->galy,
                'square_name' => $record->square_name,
                'is_system_searched' => (bool) $record->is_system_searched,
                'has_asteroids' => (bool) $record->has_asteroids,
                'planetoids_checked' => $record->planetoids_checked === null ? null : (bool) $record->planetoids_checked,
                'planetoid_1_type' => $record->planetoid_1_type,
                'planetoid_1_size' => $record->planetoid_1_size,
                'planetoid_2_type' => $record->planetoid_2_type,
                'planetoid_2_size' => $record->planetoid_2_size,
                'has_ships' => $record->has_ships === null ? null : (bool) $record->has_ships,
                'has_stations' => $record->has_stations === null ? null : (bool) $record->has_stations,
                'legacy_note' => $record->legacy_note,
                'legacy_recorded_at' => $legacyRecordedAt,
                'rescan_due_at' => $rescanDueAt,
                'is_rescan_due' => $record->rescan_due_at
                    ? Carbon::parse($record->rescan_due_at)->lte($now)
                    : false,
                'legacy_player' => $record->legacy_player,
                'legacy_icon' => $record->legacy_icon,
                'handle' => $record->legacy_handle,
                'legacy_tag' => $record->legacy_tag,
                'legacy_read' => (bool) $record->legacy_read,
                'updated_at' => $record->updated_at
                    ? Carbon::parse($record->updated_at)->toISOString()
                    : null,
            ];
        }

        return response()->json([
            'ok' => true,
            'data' => $records,
        ]);
    }

    public function sector(string $sector): JsonResponse
    {
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

        $annotations = SwcSectorCellAnnotation::query()
            ->where('sector_uid', $sectorRecord->uid)
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
            ]);

        $outlineCoordinates = collect($sectorRecord->outline_coordinates ?? [])
            ->filter(fn ($coordinate) => is_array($coordinate))
            ->values();

        $outlineKeys = $outlineCoordinates
            ->mapWithKeys(function (array $coordinate) {
                $galx = isset($coordinate['galx']) && is_numeric($coordinate['galx'])
                    ? (int) $coordinate['galx']
                    : null;
                $galy = isset($coordinate['galy']) && is_numeric($coordinate['galy'])
                    ? (int) $coordinate['galy']
                    : null;

                if ($galx === null || $galy === null) {
                    return [];
                }

                return [sprintf('%d:%d', $galx, $galy) => true];
            })
            ->all();

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

        $searchRecords = $searchRecordsQuery
            ->orderBy('galy')
            ->orderBy('galx')
            ->get([
                'id',
                'sector_uid',
                'galx',
                'galy',
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
            ->filter(function (array $record) use ($outlineKeys, $sectorRecord) {
                if ($record['sector_uid'] === $sectorRecord->uid) {
                    return true;
                }

                return isset($outlineKeys[sprintf('%d:%d', $record['galx'], $record['galy'])]);
            })
            ->values();

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
                'outline_coordinates' => $sectorRecord->outline_coordinates ?? [],
                'coordinates' => $sectorRecord->outline_coordinates ?? [],
                'bounds' => $sectorRecord->bounds,
                'systems' => $systems,
                'annotations' => $annotations,
                'search_records' => $searchRecords,
            ],
        ]);
    }

    public function system(Request $request, string $system): JsonResponse
    {
        $canViewPreviousPopulation = Permissions::hasAny(
            $request->user(),
            ['is_intel', 'is_admin']
        );

        $systemRecord = SwcSystem::query()
            ->where('uid', $system)
            ->orWhere('identifier', $system)
            ->orWhere('name', $system)
            ->firstOrFail();

        $planets = SwcPlanet::query()
            ->where('system_id', $systemRecord->id)
            ->orderBy('name')
            ->get([
                'uid',
                'identifier',
                'name',
                'owner_uid',
                'owner_name',
                'planet_type_uid',
                'planet_type_name',
                'planet_type_href',
                'size',
                'population',
                'previous_population',
                'previous_population_recorded_at',
                'galx',
                'galy',
                'sysx',
                'sysy',
                'terrain_map',
                'surface_bounds',
                'terrain_grid',
                'cities',
                'image_small_url',
                'image_large_url',
                'image_atmosphere_url',
                'image_stratosphere_url',
                'image_loworbit_url',
                'last_pulled_at',
            ]);

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
                'planets' => $planets->map(function (SwcPlanet $planet) use ($canViewPreviousPopulation) {
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
                        'population' => $planet->population,
                        'previous_population' => $canViewPreviousPopulation ? $planet->previous_population : null,
                        'previous_population_recorded_at' => $canViewPreviousPopulation ? $planet->previous_population_recorded_at : null,
                        'galx' => $planet->galx,
                        'galy' => $planet->galy,
                        'sysx' => $planet->sysx,
                        'sysy' => $planet->sysy,
                        'terrain_map' => $planet->terrain_map,
                        'surface_bounds' => $planet->surface_bounds,
                        'terrain_grid' => $planet->terrain_grid,
                        'cities' => $planet->cities,
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
                'hyperlanes' => $hyperlanes,
            ],
        ]);
    }

    public function stationTypes(): JsonResponse
    {
        $types = SwcStationType::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function shipTypes(): JsonResponse
    {
        $types = SwcShipType::query()
            ->orderBy('name')
            ->get([
                'uid',
                'name',
                'class_name',
                'description',
                'length',
                'max_speed',
                'hyperdrive',
                'max_passengers',
                'hull',
                'shield',
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

    public function facilityTypes(): JsonResponse
    {
        $types = SwcFacilityType::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
    }

    public function facilityType(string $facilityType): JsonResponse
    {
        $type = SwcFacilityType::query()
            ->where('uid', $facilityType)
            ->orWhere('name', $facilityType)
            ->firstOrFail([
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
        $types = SwcItemType::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
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

        return response()->json([
            'ok' => true,
            'data' => $type,
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
                'max_speed',
                'hyperdrive',
                'max_passengers',
                'hull',
                'shield',
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
