<?php

namespace App\Http\Controllers\Api\Admin\Universe;

use App\Http\Controllers\Controller;
use App\Jobs\RunStoredSystemRefreshJob;
use App\Jobs\RunUniverseFullSyncJob;
use App\Models\SwcPlanet;
use App\Models\SwcSystem;
use App\Models\SwcUniverseSyncRun;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\UniversePersistenceService;
use App\Support\Swc\UniversePullService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PullController extends Controller
{
    protected const SECTOR_PULLS_PER_HOUR = 250;

    public function __construct(
        protected UniversePullService $universePullService,
        protected UniversePersistenceService $universePersistenceService
    ) {
    }

    /**
     * POST /api/sys/universe/pull
     * Sysadmin-only.
     */
    public function run(Request $request): JsonResponse
    {
        $data = $request->validate([
            'resource' => ['required', 'in:system,sector,planet,planet_type,station,station_type,ship_type,vehicle_type,droid_type,creature_type,npc_type,race,weapon_type,facility_type,item_type,terrain_type,material_type'],
            'identifier' => ['required', 'string', 'max:255'],
            'persist' => ['sometimes', 'boolean'],
            'deep' => ['sometimes', 'boolean'],
            'hyperlanes_only' => ['sometimes', 'boolean'],
        ]);

        if ((string) $data['resource'] === 'sector') {
            $rateLimited = $this->consumeSectorPullAllowance();

            if ($rateLimited !== null) {
                return $rateLimited;
            }
        }

        if ((string) $data['resource'] === 'system') {
            $this->disableExecutionTimeout();
        }

        $result = $this->universePullService->pull(
            resource: (string) $data['resource'],
            identifier: (string) $data['identifier'],
        );
        $persist = (bool) ($data['persist'] ?? false);
        $deep = (bool) ($data['deep'] ?? false);
        $hyperlanesOnly = (bool) ($data['hyperlanes_only'] ?? false);
        $persistence = null;

        if ($persist) {
            $persistence = $this->universePersistenceService->persist(
                $result,
                $deep,
                null,
                ['hyperlanes_only' => $hyperlanesOnly]
            );
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull',
            'Ran direct universe pull',
            (string) $data['resource'],
            null,
            null,
            [
                'resource' => (string) $data['resource'],
                'identifier' => (string) $data['identifier'],
                'persist' => $persist,
                'deep' => $deep,
                'hyperlanes_only' => $hyperlanesOnly,
                'persistence' => $persistence,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => $persist
                ? 'Universe pull completed and data was persisted.'
                : 'Universe pull completed.',
            'data' => $result,
            'persistence' => $persistence,
        ]);
    }

    /**
     * POST /api/sys/universe/pull-sector-stream
     * Sysadmin-only.
     */
    public function runSectorStream(Request $request): StreamedResponse|JsonResponse
    {
        $this->raiseExecutionTimeout(600);

        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'persist' => ['sometimes', 'boolean'],
            'deep' => ['sometimes', 'boolean'],
        ]);

        $rateLimited = $this->consumeSectorPullAllowance();

        if ($rateLimited !== null) {
            return $rateLimited;
        }

        $identifier = (string) $data['identifier'];
        $persist = (bool) ($data['persist'] ?? false);
        $deep = (bool) ($data['deep'] ?? false);

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_sector_stream',
            'Started streamed sector pull',
            'sector',
            null,
            null,
            [
                'identifier' => $identifier,
                'persist' => $persist,
                'deep' => $deep,
            ]
        );

        return response()->stream(function () use ($identifier, $persist, $deep) {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $send('started', [
                    'identifier' => $identifier,
                    'persist' => $persist,
                    'deep' => $deep,
                ]);

                $result = $this->universePullService->pull(
                    resource: 'sector',
                    identifier: $identifier,
                );

                $send('sector_pulled', [
                    'sector' => $result['sector'] ?? null,
                    'systems' => count($result['systems'] ?? []),
                    'coordinates' => $result['sector']['coordinate_count'] ?? null,
                ]);

                $persistence = null;

                if ($persist) {
                    $send('persist_started', [
                        'deep' => $deep,
                    ]);

                    $persistence = $this->universePersistenceService->persist(
                        $result,
                        $deep,
                        function (string $event, array $payload = []) use ($send) {
                            $send($event, $payload);
                        }
                    );
                }

                $send('completed', [
                    'message' => $persist
                        ? 'Universe pull completed and data was persisted.'
                        : 'Universe pull completed.',
                    'data' => $result,
                    'persistence' => $persistence,
                ]);
            } catch (\Throwable $e) {
                $send('error', [
                    'message' => $e->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/sys/universe/pull-system-stream
     * Sysadmin-only.
     */
    public function runSystemStream(Request $request): StreamedResponse
    {
        $this->disableExecutionTimeout();

        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'persist' => ['sometimes', 'boolean'],
            'deep' => ['sometimes', 'boolean'],
        ]);

        $identifier = (string) $data['identifier'];
        $persist = (bool) ($data['persist'] ?? false);
        $deep = (bool) ($data['deep'] ?? false);

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_system_stream',
            'Started streamed system pull',
            'system',
            null,
            null,
            [
                'identifier' => $identifier,
                'persist' => $persist,
                'deep' => $deep,
            ]
        );

        return response()->stream(function () use ($identifier, $persist, $deep) {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $send('started', [
                    'identifier' => $identifier,
                    'persist' => $persist,
                    'deep' => $deep,
                ]);

                $result = $this->universePullService->pull(
                    resource: 'system',
                    identifier: $identifier,
                );

                $send('system_pulled', [
                    'system' => $result['system'] ?? null,
                    'planets' => count($result['planet_stubs'] ?? []),
                    'stations' => count($result['station_stubs'] ?? []),
                    'hyperlanes' => count($result['hyperlanes'] ?? []),
                ]);

                $persistence = null;

                if ($persist) {
                    $send('persist_started', [
                        'deep' => $deep,
                    ]);

                    $persistence = $this->universePersistenceService->persist(
                        $result,
                        $deep,
                        function (string $event, array $payload = []) use ($send) {
                            $send($event, $payload);
                        }
                    );
                }

                $send('completed', [
                    'message' => $persist
                        ? 'System pull completed and data was persisted.'
                        : 'System pull completed.',
                    'data' => $result,
                    'persistence' => $persistence,
                ]);
            } catch (\Throwable $e) {
                $send('error', [
                    'message' => $e->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    protected function consumeSectorPullAllowance(): ?JsonResponse
    {
        $key = 'sys:universe:sector-pulls';

        if (RateLimiter::tooManyAttempts($key, self::SECTOR_PULLS_PER_HOUR)) {
            $retryAfter = RateLimiter::availableIn($key);

            return response()->json([
                'ok' => false,
                'message' => 'Sector pull limit reached. Try again later.',
                'retry_after_seconds' => $retryAfter,
                'retry_after_minutes' => (int) ceil($retryAfter / 60),
            ], 429);
        }

        RateLimiter::hit($key, 3600);

        return null;
    }

    protected function disableExecutionTimeout(): void
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        if (function_exists('ignore_user_abort')) {
            @ignore_user_abort(true);
        }
    }

    protected function raiseExecutionTimeout(int $seconds): void
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit($seconds);
        }

        if (function_exists('ignore_user_abort')) {
            @ignore_user_abort(true);
        }
    }

    /**
     * POST /api/sys/universe/pull-all-sectors
     * Sysadmin-only.
     */
    public function runAllSectors(): JsonResponse
    {
        $result = $this->universePullService->pullAllSectorsIndex();
        $persistence = $this->universePersistenceService->persist($result);

        AdminActionLogger::log(
            request(),
            'universe',
            'pull_all_sectors',
            'Pulled and persisted all sector index pages',
            'sector_index',
            null,
            null,
            [
                'persistence' => $persistence,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All sector index pages pulled and persisted.',
            'data' => $result,
            'persistence' => $persistence,
        ]);
    }

    /**
     * POST /api/sys/universe/pull-all-station-types
     * Sysadmin-only.
     */
    public function runAllStationTypes(): JsonResponse
    {
        $result = $this->universePullService->pullAllStationTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['station_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('station_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            request(),
            'universe',
            'pull_all_station_types',
            'Pulled and hydrated all station types',
            'swc_station_type',
            null,
            null,
            [
                'station_type_count' => $indexPersistence['station_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_station_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All station types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'station_type_count' => $indexPersistence['station_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_station_types' => $hydrated,
            ],
        ]);
    }

    public function runAllPlanetTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllPlanetTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['planet_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('planet_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_planet_types',
            'Pulled and hydrated all planet types',
            'swc_planet_type',
            null,
            null,
            [
                'planet_type_count' => $indexPersistence['planet_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_planet_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All planet types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'planet_type_count' => $indexPersistence['planet_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_planet_types' => $hydrated,
            ],
        ]);
    }

    public function runAllPlanetTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'planet_type',
            resultKey: 'planet_types',
            resultMethod: 'pullAllPlanetTypesIndex',
            countKey: 'planet_type_count',
            hydratedKey: 'hydrated_planet_types',
            summary: 'Pulled and hydrated all planet types',
            targetType: 'swc_planet_type'
        );
    }

    public function runAllStationTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'station_type',
            resultKey: 'station_types',
            resultMethod: 'pullAllStationTypesIndex',
            countKey: 'station_type_count',
            hydratedKey: 'hydrated_station_types',
            summary: 'Pulled and hydrated all station types',
            targetType: 'swc_station_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-facility-types
     * Sysadmin-only.
     */
    public function runAllFacilityTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllFacilityTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['facility_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('facility_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_facility_types',
            'Pulled and hydrated all facility types',
            'swc_facility_type',
            null,
            null,
            [
                'facility_type_count' => $indexPersistence['facility_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_facility_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All facility types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'facility_type_count' => $indexPersistence['facility_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_facility_types' => $hydrated,
            ],
        ]);
    }

    public function runAllFacilityTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'facility_type',
            resultKey: 'facility_types',
            resultMethod: 'pullAllFacilityTypesIndex',
            countKey: 'facility_type_count',
            hydratedKey: 'hydrated_facility_types',
            summary: 'Pulled and hydrated all facility types',
            targetType: 'swc_facility_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-item-types
     * Sysadmin-only.
     */
    public function runAllItemTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllItemTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['item_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('item_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_item_types',
            'Pulled and hydrated all item types',
            'swc_item_type',
            null,
            null,
            [
                'item_type_count' => $indexPersistence['item_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_item_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All item types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'item_type_count' => $indexPersistence['item_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_item_types' => $hydrated,
            ],
        ]);
    }

    public function runAllItemTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'item_type',
            resultKey: 'item_types',
            resultMethod: 'pullAllItemTypesIndex',
            countKey: 'item_type_count',
            hydratedKey: 'hydrated_item_types',
            summary: 'Pulled and hydrated all item types',
            targetType: 'swc_item_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-ship-types
     * Sysadmin-only.
     */
    public function runAllShipTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllShipTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['ship_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('ship_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_ship_types',
            'Pulled and hydrated all ship types',
            'swc_ship_type',
            null,
            null,
            [
                'ship_type_count' => $indexPersistence['ship_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_ship_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All ship types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'ship_type_count' => $indexPersistence['ship_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_ship_types' => $hydrated,
            ],
        ]);
    }

    public function runAllShipTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'ship_type',
            resultKey: 'ship_types',
            resultMethod: 'pullAllShipTypesIndex',
            countKey: 'ship_type_count',
            hydratedKey: 'hydrated_ship_types',
            summary: 'Pulled and hydrated all ship types',
            targetType: 'swc_ship_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-vehicle-types
     * Sysadmin-only.
     */
    public function runAllVehicleTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllVehicleTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['vehicle_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('vehicle_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_vehicle_types',
            'Pulled and hydrated all vehicle types',
            'swc_vehicle_type',
            null,
            null,
            [
                'vehicle_type_count' => $indexPersistence['vehicle_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_vehicle_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All vehicle types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'vehicle_type_count' => $indexPersistence['vehicle_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_vehicle_types' => $hydrated,
            ],
        ]);
    }

    public function runAllVehicleTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'vehicle_type',
            resultKey: 'vehicle_types',
            resultMethod: 'pullAllVehicleTypesIndex',
            countKey: 'vehicle_type_count',
            hydratedKey: 'hydrated_vehicle_types',
            summary: 'Pulled and hydrated all vehicle types',
            targetType: 'swc_vehicle_type'
        );
    }

    public function runAllDroidTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllDroidTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['droid_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('droid_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_droid_types',
            'Pulled and hydrated all droid types',
            'swc_droid_type',
            null,
            null,
            [
                'droid_type_count' => $indexPersistence['droid_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_droid_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All droid types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'droid_type_count' => $indexPersistence['droid_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_droid_types' => $hydrated,
            ],
        ]);
    }

    public function runAllDroidTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'droid_type',
            resultKey: 'droid_types',
            resultMethod: 'pullAllDroidTypesIndex',
            countKey: 'droid_type_count',
            hydratedKey: 'hydrated_droid_types',
            summary: 'Pulled and hydrated all droid types',
            targetType: 'swc_droid_type'
        );
    }

    public function runAllNpcTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllNpcTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['npc_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('npc_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_npc_types',
            'Pulled and hydrated all NPC types',
            'swc_npc_type',
            null,
            null,
            [
                'npc_type_count' => $indexPersistence['npc_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_npc_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All NPC types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'npc_type_count' => $indexPersistence['npc_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_npc_types' => $hydrated,
            ],
        ]);
    }

    public function runAllNpcTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'npc_type',
            resultKey: 'npc_types',
            resultMethod: 'pullAllNpcTypesIndex',
            countKey: 'npc_type_count',
            hydratedKey: 'hydrated_npc_types',
            summary: 'Pulled and hydrated all NPC types',
            targetType: 'swc_npc_type'
        );
    }

    public function runAllRaces(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllRacesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['races'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('race', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_races',
            'Pulled and hydrated all races',
            'swc_race',
            null,
            null,
            [
                'race_count' => $indexPersistence['race_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_races' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All races pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'race_count' => $indexPersistence['race_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_races' => $hydrated,
            ],
        ]);
    }

    public function runAllRacesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'race',
            resultKey: 'races',
            resultMethod: 'pullAllRacesIndex',
            countKey: 'race_count',
            hydratedKey: 'hydrated_races',
            summary: 'Pulled and hydrated all races',
            targetType: 'swc_race'
        );
    }

    public function runAllWeaponTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllWeaponTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['weapon_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('weapon_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_weapon_types',
            'Pulled and hydrated all weapon types',
            'swc_weapon_type',
            null,
            null,
            [
                'weapon_type_count' => $indexPersistence['weapon_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_weapon_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All weapon types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'weapon_type_count' => $indexPersistence['weapon_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_weapon_types' => $hydrated,
            ],
        ]);
    }

    public function runAllWeaponTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'weapon_type',
            resultKey: 'weapon_types',
            resultMethod: 'pullAllWeaponTypesIndex',
            countKey: 'weapon_type_count',
            hydratedKey: 'hydrated_weapon_types',
            summary: 'Pulled and hydrated all weapon types',
            targetType: 'swc_weapon_type'
        );
    }

    public function runAllCreatureTypes(Request $request): JsonResponse
    {
        $result = $this->universePullService->pullAllCreatureTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['creature_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('creature_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_creature_types',
            'Pulled and hydrated all creature types',
            'swc_creature_type',
            null,
            null,
            [
                'creature_type_count' => $indexPersistence['creature_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_creature_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All creature types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'creature_type_count' => $indexPersistence['creature_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_creature_types' => $hydrated,
            ],
        ]);
    }

    public function runAllCreatureTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'creature_type',
            resultKey: 'creature_types',
            resultMethod: 'pullAllCreatureTypesIndex',
            countKey: 'creature_type_count',
            hydratedKey: 'hydrated_creature_types',
            summary: 'Pulled and hydrated all creature types',
            targetType: 'swc_creature_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-terrain-types
     * Sysadmin-only.
     */
    public function runAllTerrainTypes(): JsonResponse
    {
        $result = $this->universePullService->pullAllTerrainTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['terrain_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('terrain_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            request(),
            'universe',
            'pull_all_terrain_types',
            'Pulled and hydrated all terrain types',
            'swc_terrain_type',
            null,
            null,
            [
                'terrain_type_count' => $indexPersistence['terrain_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_terrain_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All terrain types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'terrain_type_count' => $indexPersistence['terrain_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_terrain_types' => $hydrated,
            ],
        ]);
    }

    public function runAllTerrainTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'terrain_type',
            resultKey: 'terrain_types',
            resultMethod: 'pullAllTerrainTypesIndex',
            countKey: 'terrain_type_count',
            hydratedKey: 'hydrated_terrain_types',
            summary: 'Pulled and hydrated all terrain types',
            targetType: 'swc_terrain_type'
        );
    }

    /**
     * POST /api/sys/universe/pull-all-material-types
     * Sysadmin-only.
     */
    public function runAllMaterialTypes(): JsonResponse
    {
        $result = $this->universePullService->pullAllMaterialTypesIndex();
        $indexPersistence = $this->universePersistenceService->persist($result);
        $hydrated = 0;

        foreach ((array) ($result['material_types'] ?? []) as $type) {
            if (!is_array($type)) {
                continue;
            }

            $detailPayload = $this->pullTypeDetailWithFallbacks('material_type', $type);
            $this->universePersistenceService->persist($detailPayload);
            $hydrated += 1;
        }

        AdminActionLogger::log(
            request(),
            'universe',
            'pull_all_material_types',
            'Pulled and hydrated all material types',
            'swc_material_type',
            null,
            null,
            [
                'material_type_count' => $indexPersistence['material_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_material_types' => $hydrated,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All material types pulled and persisted.',
            'data' => $result,
            'persistence' => [
                'material_type_count' => $indexPersistence['material_type_count'] ?? 0,
                'pages' => $indexPersistence['pages'] ?? null,
                'total' => $indexPersistence['total'] ?? 0,
                'hydrated_material_types' => $hydrated,
            ],
        ]);
    }

    public function runAllMaterialTypesStream(Request $request): StreamedResponse
    {
        return $this->streamTypeCatalogPull(
            $request,
            entityType: 'material_type',
            resultKey: 'material_types',
            resultMethod: 'pullAllMaterialTypesIndex',
            countKey: 'material_type_count',
            hydratedKey: 'hydrated_material_types',
            summary: 'Pulled and hydrated all material types',
            targetType: 'swc_material_type'
        );
    }

    /**
     * POST /api/sys/universe/refresh-planets
     * Sysadmin-only.
     */
    public function refreshStoredPlanets(): JsonResponse
    {
        $this->disableExecutionTimeout();

        $refreshed = 0;
        $skippedMissingIdentifier = 0;
        $skippedNotFound = 0;
        $total = SwcPlanet::query()->count();

        SwcPlanet::query()
            ->orderBy('id')
            ->chunkById(100, function ($planets) use (&$refreshed, &$skippedMissingIdentifier, &$skippedNotFound) {
                foreach ($planets as $planet) {
                    $identifiers = $this->planetRefreshIdentifiers($planet);

                    if ($identifiers === []) {
                        $skippedMissingIdentifier += 1;
                        continue;
                    }

                    try {
                        $payload = $this->refreshPlanetPayload($identifiers);
                        $this->universePersistenceService->persist($payload);
                        $refreshed += 1;
                    } catch (\Throwable $exception) {
                        if ($this->isSkippableSwcNotFoundException($exception)) {
                            $skippedNotFound += 1;
                            continue;
                        }

                        throw $exception;
                    }
                }
            });

        AdminActionLogger::log(
            request(),
            'universe',
            'refresh_stored_planets',
            'Refreshed stored planets from SWC detail payloads',
            'swc_planet',
            null,
            null,
            [
                'planet_count' => $total,
                'refreshed_planets' => $refreshed,
                'skipped_missing_identifier' => $skippedMissingIdentifier,
                'skipped_not_found' => $skippedNotFound,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Stored planets refreshed.',
            'persistence' => [
                'planet_count' => $total,
                'refreshed_planets' => $refreshed,
                'skipped_missing_identifier' => $skippedMissingIdentifier,
                'skipped_not_found' => $skippedNotFound,
            ],
        ]);
    }

    /**
     * POST /api/sys/universe/refresh-planets-stream
     * Sysadmin-only.
     */
    public function refreshStoredPlanetsStream(): StreamedResponse
    {
        $this->disableExecutionTimeout();

        AdminActionLogger::log(
            request(),
            'universe',
            'refresh_stored_planets_stream',
            'Started streamed stored-planet refresh',
            'swc_planet',
            null,
            null,
            null
        );

        return response()->stream(function () {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $total = SwcPlanet::query()->count();
                $refreshed = 0;
                $skippedMissingIdentifier = 0;
                $skippedNotFound = 0;
                $processed = 0;

                $send('started', [
                    'total' => $total,
                ]);

                SwcPlanet::query()
                    ->orderBy('id')
                    ->chunkById(100, function ($planets) use (
                        &$refreshed,
                        &$skippedMissingIdentifier,
                        &$skippedNotFound,
                        &$processed,
                        $total,
                        $send
                    ) {
                        foreach ($planets as $planet) {
                            $processed += 1;
                            $identifiers = $this->planetRefreshIdentifiers($planet);

                            if ($identifiers === []) {
                                $skippedMissingIdentifier += 1;
                                $send('planet_skipped', [
                                    'current' => $processed,
                                    'total' => $total,
                                    'uid' => $planet->uid,
                                    'name' => $planet->name,
                                    'reason' => 'missing_identifier',
                                ]);
                                continue;
                            }

                            $send('planet_refresh_started', [
                                'current' => $processed,
                                'total' => $total,
                                'uid' => $planet->uid,
                                'name' => $planet->name,
                                'identifier' => $identifiers[0] ?? null,
                            ]);

                            try {
                                $payload = $this->refreshPlanetPayload($identifiers);
                                $this->universePersistenceService->persist($payload);
                                $refreshed += 1;

                                $send('planet_refresh_completed', [
                                    'current' => $processed,
                                    'total' => $total,
                                    'uid' => $planet->uid,
                                    'name' => $planet->name,
                                    'identifier' => $identifiers[0] ?? null,
                                    'refreshed' => $refreshed,
                                ]);
                            } catch (\Throwable $exception) {
                                if ($this->isSkippableSwcNotFoundException($exception)) {
                                    $skippedNotFound += 1;
                                    $send('planet_skipped', [
                                        'current' => $processed,
                                        'total' => $total,
                                        'uid' => $planet->uid,
                                        'name' => $planet->name,
                                        'identifier' => $identifiers[0] ?? null,
                                        'reason' => 'not_found',
                                    ]);
                                    continue;
                                }

                                throw $exception;
                            }
                        }
                    });

                $send('completed', [
                    'message' => 'Stored planets refreshed.',
                    'persistence' => [
                        'planet_count' => $total,
                        'refreshed_planets' => $refreshed,
                        'skipped_missing_identifier' => $skippedMissingIdentifier,
                        'skipped_not_found' => $skippedNotFound,
                    ],
                ]);
            } catch (\Throwable $exception) {
                $send('error', [
                    'message' => $exception->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/sys/universe/refresh-systems
     * Sysadmin-only.
     */
    public function refreshStoredSystems(): JsonResponse
    {
        $this->disableExecutionTimeout();

        $refreshed = 0;
        $skippedMissingIdentifier = 0;
        $skippedNotFound = 0;
        $total = SwcSystem::query()->count();

        SwcSystem::query()
            ->orderBy('id')
            ->chunkById(100, function ($systems) use (&$refreshed, &$skippedMissingIdentifier, &$skippedNotFound) {
                foreach ($systems as $system) {
                    $identifiers = $this->systemRefreshIdentifiers($system);

                    if ($identifiers === []) {
                        $skippedMissingIdentifier += 1;
                        continue;
                    }

                    try {
                        $payload = $this->refreshSystemPayload($identifiers);
                        $this->universePersistenceService->persist($payload, true);
                        $refreshed += 1;
                    } catch (\Throwable $exception) {
                        if ($this->isSkippableSwcNotFoundException($exception)) {
                            $skippedNotFound += 1;
                            continue;
                        }

                        throw $exception;
                    }
                }
            });

        AdminActionLogger::log(
            request(),
            'universe',
            'refresh_stored_systems',
            'Refreshed stored systems from SWC detail payloads',
            'swc_system',
            null,
            null,
            [
                'system_count' => $total,
                'refreshed_systems' => $refreshed,
                'skipped_missing_identifier' => $skippedMissingIdentifier,
                'skipped_not_found' => $skippedNotFound,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Stored systems refreshed.',
            'persistence' => [
                'system_count' => $total,
                'refreshed_systems' => $refreshed,
                'skipped_missing_identifier' => $skippedMissingIdentifier,
                'skipped_not_found' => $skippedNotFound,
            ],
        ]);
    }

    public function startStoredSystemsRefresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'resume' => ['sometimes', 'boolean'],
        ]);

        $existing = SwcUniverseSyncRun::query()
            ->where('mode', 'refresh_systems')
            ->whereIn('status', ['queued', 'running', 'waiting_db_lock'])
            ->latest('id')
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => true,
                'message' => 'A background stored-systems refresh is already running.',
                'data' => $this->serializeSyncRun($existing),
            ]);
        }

        $shouldResume = (bool) ($data['resume'] ?? true);

        if ($shouldResume) {
            $resumable = SwcUniverseSyncRun::query()
                ->where('mode', 'refresh_systems')
                ->where('status', 'failed')
                ->latest('id')
                ->first();

            if ($resumable) {
                $progress = $resumable->progress ?? [];
                $processed = (int) ($progress['processed'] ?? 0);
                $total = (int) ($progress['total'] ?? 0);
                $hasRemainingWork = $total === 0 || $processed < $total;

                if ($hasRemainingWork) {
                    $resumable->forceFill([
                        'status' => 'queued',
                        'error_message' => null,
                        'finished_at' => null,
                        'next_retry_at' => null,
                        'queued_at' => now(),
                        'last_message' => sprintf(
                            'Resuming stored-systems refresh from item %d.',
                            max(1, $processed + 1)
                        ),
                    ])->save();

                    Cache::forget(sprintf('swc:universe-sync-run:%d:heartbeat', $resumable->id));

                    RunStoredSystemRefreshJob::dispatch($resumable->id)
                        ->onConnection('database')
                        ->onQueue('swc-sync');

                    AdminActionLogger::log(
                        $request,
                        'universe',
                        'resume_stored_systems_refresh',
                        'Resumed background stored-systems refresh',
                        'swc_universe_sync_run',
                        $resumable->id,
                        null,
                        [
                            'processed' => $processed,
                            'total' => $total,
                        ]
                    );

                    return response()->json([
                        'ok' => true,
                        'message' => 'Background stored-systems refresh resumed.',
                        'data' => $this->serializeSyncRun($resumable->fresh()),
                    ]);
                }
            }
        }

        $run = SwcUniverseSyncRun::query()->create([
            'mode' => 'refresh_systems',
            'status' => 'queued',
            'requested_by_user_id' => $request->user()?->id,
            'options' => [],
            'progress' => [
                'processed' => 0,
                'last_system_id' => 0,
                'total' => SwcSystem::query()->count(),
            ],
            'stats' => [
                'system_count' => SwcSystem::query()->count(),
                'refreshed_systems' => 0,
                'skipped_missing_identifier' => 0,
                'skipped_not_found' => 0,
            ],
            'last_message' => 'Stored-systems refresh queued.',
            'queued_at' => now(),
        ]);

        RunStoredSystemRefreshJob::dispatch($run->id)
            ->onConnection('database')
            ->onQueue('swc-sync');

        AdminActionLogger::log(
            $request,
            'universe',
            'start_stored_systems_refresh',
            'Queued background stored-systems refresh',
            'swc_universe_sync_run',
            $run->id,
            null,
            [
                'resume' => $shouldResume,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Background stored-systems refresh queued.',
            'data' => $this->serializeSyncRun($run->fresh()),
        ]);
    }

    public function latestStoredSystemsRefresh(): JsonResponse
    {
        $run = SwcUniverseSyncRun::query()
            ->where('mode', 'refresh_systems')
            ->latest('id')
            ->first();

        return response()->json([
            'ok' => true,
            'data' => $run ? $this->serializeSyncRun($run) : null,
        ]);
    }

    public function showStoredSystemsRefresh(SwcUniverseSyncRun $run): JsonResponse
    {
        if ($run->mode !== 'refresh_systems') {
            abort(404);
        }

        return response()->json([
            'ok' => true,
            'data' => $this->serializeSyncRun($run),
        ]);
    }

    public function cancelStoredSystemsRefresh(SwcUniverseSyncRun $run): JsonResponse
    {
        if ($run->mode !== 'refresh_systems') {
            abort(404);
        }

        if (!in_array($run->status, ['queued', 'running', 'waiting_db_lock', 'cancel_requested'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'This stored-systems refresh can no longer be cancelled.',
                'data' => $this->serializeSyncRun($run),
            ], 422);
        }

        $run->forceFill([
            'status' => 'cancel_requested',
            'last_message' => 'Cancellation requested.',
            'next_retry_at' => null,
        ])->save();

        AdminActionLogger::log(
            request(),
            'universe',
            'cancel_stored_systems_refresh',
            'Requested cancellation of background stored-systems refresh',
            'swc_universe_sync_run',
            $run->id,
            [
                'status' => $run->getOriginal('status'),
            ],
            [
                'status' => 'cancel_requested',
            ]
        );

        Cache::put(
            sprintf('swc:universe-sync-run:%d:heartbeat', $run->id),
            [
                'status' => 'cancel_requested',
                'message' => 'Cancellation requested. Waiting for the worker to stop safely.',
                'updated_at' => now()->toIso8601String(),
            ],
            now()->addHours(12)
        );

        return response()->json([
            'ok' => true,
            'message' => 'Cancellation requested.',
            'data' => $this->serializeSyncRun($run->fresh()),
        ]);
    }

    /**
     * POST /api/sys/universe/refresh-systems-stream
     * Sysadmin-only.
     */
    public function refreshStoredSystemsStream(): StreamedResponse
    {
        $this->disableExecutionTimeout();

        AdminActionLogger::log(
            request(),
            'universe',
            'refresh_stored_systems_stream',
            'Started streamed stored-system refresh',
            'swc_system',
            null,
            null,
            null
        );

        return response()->stream(function () {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $total = SwcSystem::query()->count();
                $refreshed = 0;
                $skippedMissingIdentifier = 0;
                $skippedNotFound = 0;
                $processed = 0;

                $send('started', [
                    'total' => $total,
                ]);

                SwcSystem::query()
                    ->orderBy('id')
                    ->chunkById(100, function ($systems) use (
                        &$refreshed,
                        &$skippedMissingIdentifier,
                        &$skippedNotFound,
                        &$processed,
                        $total,
                        $send
                    ) {
                        foreach ($systems as $system) {
                            $processed += 1;
                            $identifiers = $this->systemRefreshIdentifiers($system);

                            if ($identifiers === []) {
                                $skippedMissingIdentifier += 1;
                                $send('system_skipped', [
                                    'current' => $processed,
                                    'total' => $total,
                                    'uid' => $system->uid,
                                    'name' => $system->name,
                                    'reason' => 'missing_identifier',
                                ]);
                                continue;
                            }

                            $send('system_refresh_started', [
                                'current' => $processed,
                                'total' => $total,
                                'uid' => $system->uid,
                                'name' => $system->name,
                                'identifier' => $identifiers[0] ?? null,
                            ]);

                            try {
                                $payload = $this->refreshSystemPayload($identifiers);
                                $this->universePersistenceService->persist($payload, true);
                                $refreshed += 1;

                                $send('system_refresh_completed', [
                                    'current' => $processed,
                                    'total' => $total,
                                    'uid' => $system->uid,
                                    'name' => $system->name,
                                    'identifier' => $identifiers[0] ?? null,
                                    'refreshed' => $refreshed,
                                ]);
                            } catch (\Throwable $exception) {
                                if ($this->isSkippableSwcNotFoundException($exception)) {
                                    $skippedNotFound += 1;
                                    $send('system_skipped', [
                                        'current' => $processed,
                                        'total' => $total,
                                        'uid' => $system->uid,
                                        'name' => $system->name,
                                        'identifier' => $identifiers[0] ?? null,
                                        'reason' => 'not_found',
                                    ]);
                                    continue;
                                }

                                throw $exception;
                            }
                        }
                    });

                $send('completed', [
                    'message' => 'Stored systems refreshed.',
                    'persistence' => [
                        'system_count' => $total,
                        'refreshed_systems' => $refreshed,
                        'skipped_missing_identifier' => $skippedMissingIdentifier,
                        'skipped_not_found' => $skippedNotFound,
                    ],
                ]);
            } catch (\Throwable $exception) {
                $send('error', [
                    'message' => $exception->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/sys/universe/pull-all-sectors-stream
     * Sysadmin-only.
     */
    public function runAllSectorsStream(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'hydrate_details' => ['sometimes', 'boolean'],
        ]);

        $hydrateDetails = (bool) ($data['hydrate_details'] ?? true);

        AdminActionLogger::log(
            $request,
            'universe',
            'pull_all_sectors_stream',
            'Started streamed sector index pull',
            'sector_index',
            null,
            null,
            [
                'hydrate_details' => $hydrateDetails,
            ]
        );

        return response()->stream(function () use ($hydrateDetails) {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $send('started', [
                    'hydrate_details' => $hydrateDetails,
                ]);

                $indexPayload = $this->universePullService->pullAllSectorsIndex();
                $indexPersistence = $this->universePersistenceService->persist($indexPayload);
                $sectors = $indexPayload['sectors'] ?? [];
                $total = count($sectors);

                $send('index_completed', [
                    'total' => $total,
                    'persistence' => $indexPersistence,
                ]);

                $hydrated = 0;

                if ($hydrateDetails) {
                    foreach ($sectors as $index => $sector) {
                        if (!is_array($sector) || empty($sector['identifier'])) {
                            continue;
                        }

                        $send('sector_detail_started', [
                            'current' => $index + 1,
                            'total' => $total,
                            'uid' => $sector['uid'] ?? null,
                            'name' => $sector['name'] ?? null,
                            'identifier' => $sector['identifier'] ?? null,
                        ]);

                        $detailPayload = $this->universePullService->pull('sector', (string) $sector['identifier']);
                        $this->universePersistenceService->persist($detailPayload, false);
                        $hydrated += 1;

                        $send('sector_detail_completed', [
                            'current' => $index + 1,
                            'total' => $total,
                            'uid' => $sector['uid'] ?? null,
                            'name' => $sector['name'] ?? null,
                            'identifier' => $sector['identifier'] ?? null,
                            'hydrated' => $hydrated,
                        ]);
                    }
                }

                $send('completed', [
                    'message' => $hydrateDetails
                        ? 'All sectors pulled, persisted, and hydrated with detail payloads.'
                        : 'All sector index pages pulled and persisted.',
                    'persistence' => [
                        'sector_count' => $indexPersistence['sector_count'] ?? $total,
                        'pages' => $indexPersistence['pages'] ?? null,
                        'total' => $indexPersistence['total'] ?? $total,
                        'hydrated_sector_details' => $hydrated,
                    ],
                ]);
            } catch (\Throwable $e) {
                $send('error', [
                    'message' => $e->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function startFullSync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'deep' => ['sometimes', 'boolean'],
            'resume' => ['sometimes', 'boolean'],
        ]);

        $existing = SwcUniverseSyncRun::query()
            ->where('mode', 'full')
            ->whereIn('status', ['queued', 'running', 'waiting_rate_limit', 'waiting_db_lock'])
            ->latest('id')
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => true,
                'message' => 'A background universe sync is already running.',
                'data' => $this->serializeSyncRun($existing),
            ]);
        }

        $shouldResume = (bool) ($data['resume'] ?? true);
        $deep = (bool) ($data['deep'] ?? true);

        if ($shouldResume) {
            $resumable = SwcUniverseSyncRun::query()
                ->where('mode', 'full')
                ->where('status', 'failed')
                ->latest('id')
                ->first();

            if ($resumable) {
                $progress = $resumable->progress ?? [];
                $sectorCursor = (int) ($progress['sector_cursor'] ?? 0);
                $sectorTotal = (int) ($progress['sector_total'] ?? 0);
                $hasRemainingWork = $sectorTotal === 0 || $sectorCursor < $sectorTotal;

                if ($hasRemainingWork) {
                    $options = $resumable->options ?? [];
                    $options['deep'] = $deep;

                    $resumable->forceFill([
                        'status' => 'queued',
                        'options' => $options,
                        'error_message' => null,
                        'finished_at' => null,
                        'next_retry_at' => null,
                        'queued_at' => now(),
                        'last_message' => sprintf(
                            'Resuming full universe sync from sector %d.',
                            max(1, $sectorCursor + 1)
                        ),
                    ])->save();

                    Cache::forget(sprintf('swc:universe-sync-run:%d:heartbeat', $resumable->id));

                    RunUniverseFullSyncJob::dispatch($resumable->id)
                        ->onConnection('database')
                        ->onQueue('swc-sync');

                    AdminActionLogger::log(
                        $request,
                        'universe',
                        'resume_full_sync',
                        'Resumed background full universe sync',
                        'swc_universe_sync_run',
                        $resumable->id,
                        null,
                        [
                            'deep' => $deep,
                            'resume' => true,
                            'sector_cursor' => $sectorCursor,
                            'sector_total' => $sectorTotal,
                        ]
                    );

                    return response()->json([
                        'ok' => true,
                        'message' => 'Background universe sync resumed.',
                        'data' => $this->serializeSyncRun($resumable->fresh()),
                    ]);
                }
            }
        }

        $run = SwcUniverseSyncRun::query()->create([
            'mode' => 'full',
            'status' => 'queued',
            'requested_by_user_id' => $request->user()?->id,
            'options' => [
                'deep' => $deep,
            ],
            'progress' => [
                'sector_cursor' => 0,
            ],
            'stats' => [],
            'last_message' => 'Full universe sync queued.',
            'queued_at' => now(),
        ]);

        RunUniverseFullSyncJob::dispatch($run->id)
            ->onConnection('database')
            ->onQueue('swc-sync');

        AdminActionLogger::log(
            $request,
            'universe',
            'start_full_sync',
            'Queued background full universe sync',
            'swc_universe_sync_run',
            $run->id,
            null,
            [
                'deep' => $deep,
                'resume' => $shouldResume,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Background universe sync queued.',
            'data' => $this->serializeSyncRun($run->fresh()),
        ]);
    }

    public function latestFullSync(): JsonResponse
    {
        $run = SwcUniverseSyncRun::query()
            ->where('mode', 'full')
            ->latest('id')
            ->first();

        return response()->json([
            'ok' => true,
            'data' => $run ? $this->serializeSyncRun($run) : null,
        ]);
    }

    public function showFullSync(SwcUniverseSyncRun $run): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => $this->serializeSyncRun($run),
        ]);
    }

    public function cancelFullSync(SwcUniverseSyncRun $run): JsonResponse
    {
        if (!in_array($run->status, ['queued', 'running', 'waiting_rate_limit', 'cancel_requested'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'This sync run can no longer be cancelled.',
                'data' => $this->serializeSyncRun($run),
            ], 422);
        }

        $run->forceFill([
            'status' => 'cancel_requested',
            'last_message' => 'Cancellation requested.',
            'next_retry_at' => null,
        ])->save();

        AdminActionLogger::log(
            request(),
            'universe',
            'cancel_full_sync',
            'Requested cancellation of background full universe sync',
            'swc_universe_sync_run',
            $run->id,
            [
                'status' => $run->getOriginal('status'),
            ],
            [
                'status' => 'cancel_requested',
            ]
        );

        Cache::put(
            sprintf('swc:universe-sync-run:%d:heartbeat', $run->id),
            [
                'status' => 'cancel_requested',
                'message' => 'Cancellation requested. Waiting for the worker to stop safely.',
                'updated_at' => now()->toIso8601String(),
            ],
            now()->addHours(12)
        );

        return response()->json([
            'ok' => true,
            'message' => 'Cancellation requested.',
            'data' => $this->serializeSyncRun($run->fresh()),
        ]);
    }

    protected function serializeSyncRun(SwcUniverseSyncRun $run): array
    {
        return [
            'id' => $run->id,
            'mode' => $run->mode,
            'status' => $run->status,
            'options' => $run->options ?? [],
            'progress' => $run->progress ?? [],
            'stats' => $run->stats ?? [],
            'last_message' => $run->last_message,
            'error_message' => $run->error_message,
            'heartbeat' => Cache::get(sprintf('swc:universe-sync-run:%d:heartbeat', $run->id)),
            'queued_at' => optional($run->queued_at)?->toIso8601String(),
            'started_at' => optional($run->started_at)?->toIso8601String(),
            'finished_at' => optional($run->finished_at)?->toIso8601String(),
            'next_retry_at' => optional($run->next_retry_at)?->toIso8601String(),
            'updated_at' => optional($run->updated_at)?->toIso8601String(),
        ];
    }

    protected function isSkippableSwcNotFoundException(\Throwable $exception): bool
    {
        return str_contains($exception->getMessage(), 'SWC request failed with status 404');
    }

    /**
     * @return list<string>
     */
    protected function planetRefreshIdentifiers(SwcPlanet $planet): array
    {
        $candidates = [
            trim((string) ($planet->identifier ?? '')),
            trim((string) ($planet->uid ?? '')),
            trim((string) ($planet->name ?? '')),
        ];

        return array_values(array_unique(array_filter($candidates, fn ($value) => $value !== '')));
    }

    /**
     * @return list<string>
     */
    protected function systemRefreshIdentifiers(SwcSystem $system): array
    {
        $candidates = [
            trim((string) ($system->identifier ?? '')),
            trim((string) ($system->uid ?? '')),
            trim((string) ($system->name ?? '')),
        ];

        return array_values(array_unique(array_filter($candidates, fn ($value) => $value !== '')));
    }

    /**
     * @param array<string, mixed> $type
     */
    protected function pullTypeDetailWithFallbacks(string $resource, array $type): array
    {
        $identifiers = array_values(array_unique(array_filter([
            trim((string) ($type['uid'] ?? '')),
            trim((string) ($type['identifier'] ?? '')),
            trim((string) ($type['name'] ?? '')),
        ], fn ($value) => $value !== '')));

        if ($identifiers === []) {
            throw new \RuntimeException('Type detail pull could not determine an identifier.');
        }

        $lastException = null;

        foreach ($identifiers as $identifier) {
            try {
                return $this->universePullService->pull($resource, $identifier);
            } catch (\Throwable $exception) {
                if (
                    !$this->isSkippableSwcNotFoundException($exception)
                    && !$this->isSkippableTypeDetailFailure($exception)
                ) {
                    throw $exception;
                }

                $lastException = $exception;
            }
        }

        throw $lastException ?? new \RuntimeException('Type detail pull failed.');
    }

    protected function isSkippableTypeDetailFailure(\Throwable $exception): bool
    {
        $message = strtolower(trim((string) $exception->getMessage()));

        if ($message === '') {
            return false;
        }

        return str_contains($message, 'status 403')
            || str_contains($message, 'status 404');
    }

    protected function streamTypeCatalogPull(
        Request $request,
        string $entityType,
        string $resultKey,
        string $resultMethod,
        string $countKey,
        string $hydratedKey,
        string $summary,
        string $targetType
    ): StreamedResponse {
        return response()->stream(function () use (
            $request,
            $entityType,
            $resultKey,
            $resultMethod,
            $countKey,
            $hydratedKey,
            $summary,
            $targetType
        ) {
            $send = function (string $event, array $payload = []) {
                echo json_encode([
                    'event' => $event,
                    'payload' => $payload,
                ], JSON_UNESCAPED_SLASHES) . "\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            try {
                $send('started', [
                    'entity_type' => $entityType,
                ]);

                /** @var array $result */
                $result = $this->universePullService->{$resultMethod}();
                $indexPersistence = $this->universePersistenceService->persist($result);
                $items = array_values(array_filter((array) ($result[$resultKey] ?? []), 'is_array'));
                $total = count($items);
                $hydrated = 0;

                $send('index_completed', [
                    'total' => $total,
                    'persistence' => $indexPersistence,
                ]);

                foreach ($items as $index => $type) {
                    $send('detail_started', [
                        'current' => $index + 1,
                        'total' => $total,
                        'uid' => $type['uid'] ?? null,
                        'name' => $type['name'] ?? null,
                        'identifier' => $type['identifier'] ?? null,
                    ]);

                    $detailPayload = $this->pullTypeDetailWithFallbacks($entityType, $type);
                    $this->universePersistenceService->persist($detailPayload);
                    $hydrated += 1;

                    $send('detail_completed', [
                        'current' => $index + 1,
                        'total' => $total,
                        'uid' => $type['uid'] ?? null,
                        'name' => $type['name'] ?? null,
                        'identifier' => $type['identifier'] ?? null,
                        'hydrated' => $hydrated,
                    ]);
                }

                AdminActionLogger::log(
                    $request,
                    'universe',
                    'pull_all_' . $resultKey . '_stream',
                    $summary . ' via streamed pull',
                    $targetType,
                    null,
                    null,
                    [
                        $countKey => $indexPersistence[$countKey] ?? 0,
                        'pages' => $indexPersistence['pages'] ?? null,
                        'total' => $indexPersistence['total'] ?? 0,
                        $hydratedKey => $hydrated,
                    ]
                );

                $send('completed', [
                    'message' => str_replace('Pulled and hydrated', 'All', $summary) . '.',
                    'persistence' => [
                        $countKey => $indexPersistence[$countKey] ?? 0,
                        'pages' => $indexPersistence['pages'] ?? null,
                        'total' => $indexPersistence['total'] ?? 0,
                        $hydratedKey => $hydrated,
                    ],
                ]);
            } catch (\Throwable $exception) {
                $send('error', [
                    'message' => $exception->getMessage(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * @param list<string> $identifiers
     */
    protected function refreshPlanetPayload(array $identifiers): array
    {
        $lastException = null;

        foreach ($identifiers as $identifier) {
            try {
                return $this->universePullService->pull('planet', $identifier);
            } catch (\Throwable $exception) {
                $lastException = $exception;

                if (!$this->isSkippableSwcNotFoundException($exception)) {
                    throw $exception;
                }
            }
        }

        if ($lastException instanceof \Throwable) {
            throw $lastException;
        }

        throw new \RuntimeException('Planet refresh did not have any valid identifiers to try.');
    }

    /**
     * @param list<string> $identifiers
     */
    protected function refreshSystemPayload(array $identifiers): array
    {
        $lastException = null;

        foreach ($identifiers as $identifier) {
            try {
                return $this->universePullService->pull('system', $identifier);
            } catch (\Throwable $exception) {
                $lastException = $exception;

                if (!$this->isSkippableSwcNotFoundException($exception)) {
                    throw $exception;
                }
            }
        }

        if ($lastException instanceof \Throwable) {
            throw $lastException;
        }

        throw new \RuntimeException('System refresh did not have any valid identifiers to try.');
    }
}
