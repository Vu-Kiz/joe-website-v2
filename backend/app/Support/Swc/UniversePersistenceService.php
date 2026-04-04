<?php

namespace App\Support\Swc;

use App\Models\SwcHyperlane;
use App\Models\SwcFacilityType;
use App\Models\SwcCreatureType;
use App\Models\SwcDroidType;
use App\Models\SwcItemType;
use App\Models\SwcMaterialType;
use App\Models\SwcNpcType;
use App\Models\SwcPlanet;
use App\Models\SwcPlanetType;
use App\Models\SwcRace;
use App\Models\SwcSector;
use App\Models\SwcShipType;
use App\Models\SwcStation;
use App\Models\SwcStationType;
use App\Models\SwcTerrainType;
use App\Models\SwcSystem;
use App\Models\SwcVehicleType;
use App\Models\SwcWeaponType;
use Illuminate\Database\QueryException;

class UniversePersistenceService
{
    public function __construct(
        protected UniversePullService $universePullService
    ) {
    }

    public function persist(array $payload, bool $deep = false, ?callable $progress = null, array $options = []): array
    {
        return match ($payload['resource'] ?? null) {
            'sector_index' => $this->persistSectorIndexPayload($payload),
            'sector' => $this->persistSectorPayload($payload, $deep, $progress),
            'system' => $this->persistSystemPayload($payload, $deep, $progress, $options),
            'planet' => $this->persistPlanetPayload($payload),
            'planet_type_index' => $this->persistPlanetTypeIndexPayload($payload),
            'planet_type' => $this->persistPlanetTypePayload($payload),
            'station' => $this->persistStationPayload($payload),
            'creature_type_index' => $this->persistCreatureTypeIndexPayload($payload),
            'creature_type' => $this->persistCreatureTypePayload($payload),
            'droid_type_index' => $this->persistDroidTypeIndexPayload($payload),
            'droid_type' => $this->persistDroidTypePayload($payload),
            'npc_type_index' => $this->persistNpcTypeIndexPayload($payload),
            'npc_type' => $this->persistNpcTypePayload($payload),
            'race_index' => $this->persistRaceIndexPayload($payload),
            'race' => $this->persistRacePayload($payload),
            'weapon_type_index' => $this->persistWeaponTypeIndexPayload($payload),
            'weapon_type' => $this->persistWeaponTypePayload($payload),
            'vehicle_type_index' => $this->persistVehicleTypeIndexPayload($payload),
            'vehicle_type' => $this->persistVehicleTypePayload($payload),
            'item_type_index' => $this->persistItemTypeIndexPayload($payload),
            'item_type' => $this->persistItemTypePayload($payload),
            'facility_type_index' => $this->persistFacilityTypeIndexPayload($payload),
            'facility_type' => $this->persistFacilityTypePayload($payload),
            'ship_type_index' => $this->persistShipTypeIndexPayload($payload),
            'ship_type' => $this->persistShipTypePayload($payload),
            'station_type_index' => $this->persistStationTypeIndexPayload($payload),
            'station_type' => $this->persistStationTypePayload($payload),
            'terrain_type_index' => $this->persistTerrainTypeIndexPayload($payload),
            'terrain_type' => $this->persistTerrainTypePayload($payload),
            'material_type_index' => $this->persistMaterialTypeIndexPayload($payload),
            'material_type' => $this->persistMaterialTypePayload($payload),
            default => throw new \InvalidArgumentException('Unsupported universe persistence resource.'),
        };
    }

    protected function persistSectorIndexPayload(array $payload): array
    {
        $items = collect($payload['sectors'] ?? []);
        $persisted = 0;

        foreach ($items as $sectorData) {
            if (!is_array($sectorData) || empty($sectorData['uid'])) {
                continue;
            }

            SwcSector::updateOrCreate(
                ['uid' => (string) $sectorData['uid']],
                [
                    'name' => $sectorData['name'] ?? null,
                    'owner_uid' => $sectorData['owner_uid'] ?? null,
                    'owner_name' => $sectorData['owner_name'] ?? null,
                    'population' => $sectorData['population'] ?? null,
                    'known_systems' => $sectorData['known_systems'] ?? null,
                    'system_count' => (int) ($sectorData['known_systems'] ?? 0),
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'sector_index',
            'persisted' => true,
            'sector_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistSectorPayload(array $payload, bool $deep, ?callable $progress = null): array
    {
        $sectorData = (array) ($payload['sector'] ?? []);
        $sector = $this->upsertSectorRecord(
            (string) ($sectorData['uid'] ?? $payload['identifier']),
            [
                'name' => $sectorData['name'] ?? null,
                'owner_uid' => $sectorData['owner_uid'] ?? null,
                'owner_name' => $sectorData['owner_name'] ?? null,
                'population' => $sectorData['population'] ?? null,
                'known_systems' => $sectorData['known_systems'] ?? null,
                'coordinate_count' => (int) ($sectorData['coordinate_count'] ?? 0),
                'system_count' => (int) ($sectorData['system_count'] ?? 0),
                'color_r' => $sectorData['color_r'] ?? null,
                'color_g' => $sectorData['color_g'] ?? null,
                'color_b' => $sectorData['color_b'] ?? null,
                'color_hex' => $sectorData['color_hex'] ?? null,
                'outline_coordinates' => $payload['outline_coordinates'] ?? $payload['coordinates'] ?? null,
                'bounds' => $payload['bounds'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        if ($progress) {
            $progress('sector_saved', [
                'sector_uid' => $sector->uid,
                'sector_name' => $sector->name,
                'deep' => $deep,
            ]);
        }

        $systems = collect($payload['systems'] ?? []);
        $persistedSystemUids = [];
        $deepSyncedSystems = 0;
        $totalSystems = $systems->count();
        $planetsUpserted = 0;
        $stationsUpserted = 0;
        $hyperlanesUpserted = 0;
        $planetsDeepSynced = 0;
        $stationsDeepSynced = 0;
        $destinationSystemsSynced = 0;

        foreach ($systems as $index => $systemData) {
            if (!is_array($systemData)) {
                continue;
            }

            $system = $this->upsertSystem($systemData, $sector);
            if ($system) {
                $persistedSystemUids[] = $system->uid;
            }

            if ($progress) {
                $progress('system_upserted', [
                    'current' => $index + 1,
                    'total' => $totalSystems,
                    'uid' => $systemData['uid'] ?? null,
                    'name' => $systemData['name'] ?? null,
                    'identifier' => $systemData['identifier'] ?? null,
                    'deep' => $deep,
                ]);
            }

            $refreshIdentifiers = $this->systemRefreshIdentifiers($systemData);

            if ($deep && $refreshIdentifiers !== []) {
                if ($progress) {
                    $progress('system_pull_started', [
                        'current' => $index + 1,
                        'total' => $totalSystems,
                        'uid' => $systemData['uid'] ?? null,
                        'name' => $systemData['name'] ?? null,
                        'identifier' => $refreshIdentifiers[0] ?? null,
                    ]);
                }

                try {
                    $fullPayload = $this->refreshSystemPayload($refreshIdentifiers);
                    $systemPersistence = $this->persistSystemPayload($fullPayload, true, $progress);
                    $deepSyncedSystems += 1;
                    $planetsUpserted += (int) ($systemPersistence['planets_upserted'] ?? 0);
                    $stationsUpserted += (int) ($systemPersistence['stations_upserted'] ?? 0);
                    $hyperlanesUpserted += (int) ($systemPersistence['hyperlanes_upserted'] ?? 0);
                    $planetsDeepSynced += (int) ($systemPersistence['planets_deep_synced'] ?? 0);
                    $stationsDeepSynced += (int) ($systemPersistence['stations_deep_synced'] ?? 0);
                    $destinationSystemsSynced += (int) ($systemPersistence['destination_systems_synced'] ?? 0);

                    if ($progress) {
                        $progress('system_pull_completed', [
                            'current' => $index + 1,
                            'total' => $totalSystems,
                            'uid' => $systemData['uid'] ?? null,
                            'name' => $systemData['name'] ?? null,
                            'identifier' => $refreshIdentifiers[0] ?? null,
                            'deep_synced' => $deepSyncedSystems,
                        ]);
                    }
                } catch (\Throwable $exception) {
                    if (!$this->isSkippableSwcNotFoundException($exception)) {
                        throw $exception;
                    }

                    if ($progress) {
                        $progress('system_pull_skipped', [
                            'current' => $index + 1,
                            'total' => $totalSystems,
                            'uid' => $systemData['uid'] ?? null,
                            'name' => $systemData['name'] ?? null,
                            'identifier' => $refreshIdentifiers[0] ?? null,
                            'reason' => $exception->getMessage(),
                        ]);
                    }
                }
            }
        }

        return [
            'resource' => 'sector',
            'persisted' => true,
            'deep' => $deep,
            'sector_uid' => $sector->uid,
            'sector_id' => $sector->id,
            'systems_upserted' => count($persistedSystemUids),
            'systems_deep_synced' => $deepSyncedSystems,
            'planets_upserted' => $planetsUpserted,
            'stations_upserted' => $stationsUpserted,
            'hyperlanes_upserted' => $hyperlanesUpserted,
            'planets_deep_synced' => $planetsDeepSynced,
            'stations_deep_synced' => $stationsDeepSynced,
            'destination_systems_synced' => $destinationSystemsSynced,
        ];
    }

    protected function persistSystemPayload(array $payload, bool $deep = false, ?callable $progress = null, array $options = []): array
    {
        $systemData = (array) ($payload['system'] ?? []);
        $sector = $this->findOrCreateSectorShell($systemData);
        $system = $this->upsertSystem($systemData, $sector, (string) ($payload['identifier'] ?? ''));
        $hyperlanesOnly = (bool) ($options['hyperlanes_only'] ?? false);

        if (!$system) {
            throw new \RuntimeException('System payload could not be persisted without a UID.');
        }

        $planetUids = [];
        $deepPlanetCount = 0;
        if (!$hyperlanesOnly) {
            foreach ((array) ($payload['planet_stubs'] ?? []) as $planetData) {
                if (!is_array($planetData)) {
                    continue;
                }

                $planet = $this->upsertPlanet($planetData, $sector, $system);
                if ($planet) {
                    $planetUids[] = $planet->uid;
                }

                if ($progress) {
                    $progress('planet_upserted', [
                        'system_uid' => $system->uid,
                        'uid' => $planetData['uid'] ?? null,
                        'name' => $planetData['name'] ?? null,
                        'identifier' => $planetData['identifier'] ?? null,
                        'deep' => $deep,
                    ]);
                }

                if ($deep && !empty($planetData['identifier'])) {
                    if ($progress) {
                        $progress('planet_pull_started', [
                            'system_uid' => $system->uid,
                            'uid' => $planetData['uid'] ?? null,
                            'name' => $planetData['name'] ?? null,
                            'identifier' => $planetData['identifier'] ?? null,
                        ]);
                    }

                    try {
                        $fullPlanetPayload = $this->universePullService->pull('planet', (string) $planetData['identifier']);
                        $this->persistPlanetPayload($fullPlanetPayload);
                        $deepPlanetCount += 1;

                        if ($progress) {
                            $progress('planet_pull_completed', [
                                'system_uid' => $system->uid,
                                'uid' => $planetData['uid'] ?? null,
                                'name' => $planetData['name'] ?? null,
                                'identifier' => $planetData['identifier'] ?? null,
                                'deep_synced' => $deepPlanetCount,
                            ]);
                        }
                    } catch (\Throwable $exception) {
                        if (!$this->isSkippableSwcNotFoundException($exception)) {
                            throw $exception;
                        }

                        if ($progress) {
                            $progress('planet_pull_skipped', [
                                'system_uid' => $system->uid,
                                'uid' => $planetData['uid'] ?? null,
                                'name' => $planetData['name'] ?? null,
                                'identifier' => $planetData['identifier'] ?? null,
                                'reason' => $exception->getMessage(),
                            ]);
                        }
                    }
                }
            }
        }

        $stationUids = [];
        $deepStationCount = 0;
        if (!$hyperlanesOnly) {
            foreach ((array) ($payload['station_stubs'] ?? []) as $stationData) {
                if (!is_array($stationData)) {
                    continue;
                }

                $station = $this->upsertStation($stationData, $sector, $system);
                if ($station) {
                    $stationUids[] = $station->uid;
                }

                if ($progress) {
                    $progress('station_upserted', [
                        'system_uid' => $system->uid,
                        'uid' => $stationData['uid'] ?? null,
                        'name' => $stationData['name'] ?? null,
                        'identifier' => $stationData['identifier'] ?? null,
                        'deep' => $deep,
                    ]);
                }

                if ($deep && !empty($stationData['identifier'])) {
                    if ($progress) {
                        $progress('station_pull_started', [
                            'system_uid' => $system->uid,
                            'uid' => $stationData['uid'] ?? null,
                            'name' => $stationData['name'] ?? null,
                            'identifier' => $stationData['identifier'] ?? null,
                        ]);
                    }

                    try {
                        $fullStationPayload = $this->universePullService->pull('station', (string) $stationData['identifier']);
                        $this->persistStationPayload($fullStationPayload);
                        $deepStationCount += 1;

                        if ($progress) {
                            $progress('station_pull_completed', [
                                'system_uid' => $system->uid,
                                'uid' => $stationData['uid'] ?? null,
                                'name' => $stationData['name'] ?? null,
                                'identifier' => $stationData['identifier'] ?? null,
                                'deep_synced' => $deepStationCount,
                            ]);
                        }
                    } catch (\Throwable $exception) {
                        if (!$this->isSkippableSwcNotFoundException($exception)) {
                            throw $exception;
                        }

                        if ($progress) {
                            $progress('station_pull_skipped', [
                                'system_uid' => $system->uid,
                                'uid' => $stationData['uid'] ?? null,
                                'name' => $stationData['name'] ?? null,
                                'identifier' => $stationData['identifier'] ?? null,
                                'reason' => $exception->getMessage(),
                            ]);
                        }
                    }
                }
            }
        }

        $hyperlaneNames = [];
        foreach ((array) ($payload['hyperlanes'] ?? []) as $laneData) {
            if (!is_array($laneData)) {
                continue;
            }

            $hyperlane = $this->upsertHyperlane($laneData, $system);
            if ($hyperlane) {
                $hyperlaneNames[] = $hyperlane->name;
            }

            if ($progress) {
                $progress('hyperlane_upserted', [
                    'system_uid' => $system->uid,
                    'name' => $laneData['name'] ?? null,
                    'destination_uid' => $laneData['destination_uid'] ?? null,
                    'deep' => $deep,
                ]);
            }
        }

        if (!$hyperlanesOnly && $planetUids !== []) {
            SwcPlanet::where('system_id', $system->id)
                ->whereNotIn('uid', $planetUids)
                ->delete();
        }

        if (!$hyperlanesOnly && $stationUids !== []) {
            SwcStation::where('system_id', $system->id)
                ->whereNotIn('uid', $stationUids)
                ->delete();
        }

        if ($hyperlaneNames !== []) {
            SwcHyperlane::where('source_system_id', $system->id)
                ->whereNotIn('name', $hyperlaneNames)
                ->delete();
        }

        return [
            'resource' => 'system',
            'persisted' => true,
            'deep' => $deep,
            'system_uid' => $system->uid,
            'system_id' => $system->id,
            'planets_upserted' => count($planetUids),
            'stations_upserted' => count($stationUids),
            'hyperlanes_upserted' => count($hyperlaneNames),
            'planets_deep_synced' => $deepPlanetCount,
            'stations_deep_synced' => $deepStationCount,
            'destination_systems_synced' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $systemData
     * @return list<string>
     */
    protected function systemRefreshIdentifiers(array $systemData): array
    {
        $candidates = [
            trim((string) ($systemData['identifier'] ?? '')),
            trim((string) ($systemData['uid'] ?? '')),
            trim((string) ($systemData['name'] ?? '')),
        ];

        return array_values(array_unique(array_filter($candidates, fn ($value) => $value !== '')));
    }

    /**
     * @param  list<string>  $identifiers
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

    protected function persistPlanetPayload(array $payload): array
    {
        $planetData = (array) ($payload['planet'] ?? []);
        $this->syncTerrainTypesForPlanet($planetData);
        $sector = $this->findOrCreateSectorShell($planetData);
        $system = $this->findOrCreateSystemShell($planetData, $sector);
        $planet = $this->upsertPlanet($planetData, $sector, $system, (string) ($payload['identifier'] ?? ''));

        if (!$planet) {
            throw new \RuntimeException('Planet payload could not be persisted without a UID.');
        }

        return [
            'resource' => 'planet',
            'persisted' => true,
            'planet_uid' => $planet->uid,
            'planet_id' => $planet->id,
        ];
    }

    protected function persistStationPayload(array $payload): array
    {
        $stationData = (array) ($payload['station'] ?? []);
        $sector = $this->findOrCreateSectorShell($stationData);
        $system = $this->findOrCreateSystemShell($stationData, $sector);
        $station = $this->upsertStation($stationData, $sector, $system, (string) ($payload['identifier'] ?? ''));

        if (!$station) {
            throw new \RuntimeException('Station payload could not be persisted without a UID.');
        }

        return [
            'resource' => 'station',
            'persisted' => true,
            'station_uid' => $station->uid,
            'station_id' => $station->id,
        ];
    }

    protected function persistStationTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['station_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcStationType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'station_type_index',
            'persisted' => true,
            'station_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistPlanetTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['planet_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcPlanetType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'planet_type_index',
            'persisted' => true,
            'planet_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistPlanetTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['planet_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Planet type payload could not be persisted without a UID.');
        }

        $type = SwcPlanetType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'planet_type',
            'persisted' => true,
            'planet_type_uid' => $type->uid,
            'planet_type_id' => $type->id,
        ];
    }

    protected function persistShipTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['ship_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcShipType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'ship_type_index',
            'persisted' => true,
            'ship_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistVehicleTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['vehicle_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcVehicleType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'vehicle_type_index',
            'persisted' => true,
            'vehicle_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistNpcTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['npc_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcNpcType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'npc_type_index',
            'persisted' => true,
            'npc_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistDroidTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['droid_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcDroidType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'droid_type_index',
            'persisted' => true,
            'droid_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistRaceIndexPayload(array $payload): array
    {
        $items = collect($payload['races'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcRace::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'race_index',
            'persisted' => true,
            'race_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistWeaponTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['weapon_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcWeaponType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'weapon_type_index',
            'persisted' => true,
            'weapon_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistCreatureTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['creature_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcCreatureType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'creature_type_index',
            'persisted' => true,
            'creature_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistFacilityTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['facility_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcFacilityType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'facility_type_index',
            'persisted' => true,
            'facility_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistItemTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['item_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcItemType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'item_type_index',
            'persisted' => true,
            'item_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistItemTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['item_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Item type payload could not be persisted without a UID.');
        }

        $type = SwcItemType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_uid' => $typeData['class_uid'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'item_type',
            'persisted' => true,
            'item_type_uid' => $type->uid,
            'item_type_id' => $type->id,
        ];
    }

    protected function persistFacilityTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['facility_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Facility type payload could not be persisted without a UID.');
        }

        $type = SwcFacilityType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_uid' => $typeData['class_uid'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'size' => $typeData['size'] ?? null,
                'sensors' => $typeData['sensors'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'volume_capacity_m3' => $typeData['volume_capacity_m3'] ?? null,
                'max_passengers' => $typeData['max_passengers'] ?? null,
                'flat_count' => $typeData['flat_count'] ?? null,
                'job_count' => $typeData['job_count'] ?? null,
                'size_x' => $typeData['size_x'] ?? null,
                'size_y' => $typeData['size_y'] ?? null,
                'length' => $typeData['length'] ?? null,
                'width' => $typeData['width'] ?? null,
                'height' => $typeData['height'] ?? null,
                'hull' => $typeData['hull'] ?? null,
                'shield' => $typeData['shield'] ?? null,
                'ionic_capacity' => $typeData['ionic_capacity'] ?? null,
                'energy' => $typeData['energy'] ?? null,
                'can_load_materials' => $typeData['can_load_materials'] ?? null,
                'can_earn_income' => $typeData['can_earn_income'] ?? null,
                'medical_rooms' => $typeData['medical_rooms'] ?? null,
                'has_hangar_bay' => $typeData['has_hangar_bay'] ?? null,
                'has_docking_bay' => $typeData['has_docking_bay'] ?? null,
                'can_recycle' => $typeData['can_recycle'] ?? null,
                'can_produce' => $typeData['can_produce'] ?? null,
                'can_mine' => $typeData['can_mine'] ?? null,
                'can_refine_alazhi' => $typeData['can_refine_alazhi'] ?? null,
                'can_farm_alazhi' => $typeData['can_farm_alazhi'] ?? null,
                'can_research' => $typeData['can_research'] ?? null,
                'description' => $typeData['description'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'production_modifier' => $typeData['production_modifier'] ?? null,
                'recommended_workers' => $typeData['recommended_workers'] ?? null,
                'recycling_xp' => $typeData['recycling_xp'] ?? null,
                'generic_slots' => $typeData['generic_slots'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'materials' => $typeData['materials'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'facility_type',
            'persisted' => true,
            'facility_type_uid' => $type->uid,
            'facility_type_id' => $type->id,
        ];
    }

    protected function persistShipTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['ship_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Ship type payload could not be persisted without a UID.');
        }

        $type = SwcShipType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'length' => $typeData['length'] ?? null,
                'manoeuvrability' => $typeData['manoeuvrability'] ?? null,
                'sensors' => $typeData['sensors'] ?? null,
                'ecm' => $typeData['ecm'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'weight_capacity_tonnes' => $typeData['weight_capacity_tonnes'] ?? null,
                'volume_capacity_m3' => $typeData['volume_capacity_m3'] ?? null,
                'max_speed' => $typeData['max_speed'] ?? null,
                'hyperdrive' => $typeData['hyperdrive'] ?? null,
                'max_passengers' => $typeData['max_passengers'] ?? null,
                'escape_pods' => $typeData['escape_pods'] ?? null,
                'hull' => $typeData['hull'] ?? null,
                'shield' => $typeData['shield'] ?? null,
                'armour' => $typeData['armour'] ?? null,
                'ionic_capacity' => $typeData['ionic_capacity'] ?? null,
                'has_repulsors' => $typeData['has_repulsors'] ?? null,
                'slot_size' => $typeData['slot_size'] ?? null,
                'medical_rooms' => $typeData['medical_rooms'] ?? null,
                'has_hangar_bay' => $typeData['has_hangar_bay'] ?? null,
                'has_docking_bay' => $typeData['has_docking_bay'] ?? null,
                'can_recycle' => $typeData['can_recycle'] ?? null,
                'can_interdict' => $typeData['can_interdict'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'production_modifier' => $typeData['production_modifier'] ?? null,
                'recommended_workers' => $typeData['recommended_workers'] ?? null,
                'recycling_xp' => $typeData['recycling_xp'] ?? null,
                'generic_slots' => $typeData['generic_slots'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'materials' => $typeData['materials'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'ship_type',
            'persisted' => true,
            'ship_type_uid' => $type->uid,
            'ship_type_id' => $type->id,
        ];
    }

    protected function persistVehicleTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['vehicle_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Vehicle type payload could not be persisted without a UID.');
        }

        $type = SwcVehicleType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'length' => $typeData['length'] ?? null,
                'manoeuvrability' => $typeData['manoeuvrability'] ?? null,
                'sensors' => $typeData['sensors'] ?? null,
                'ecm' => $typeData['ecm'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'weight_capacity_tonnes' => $typeData['weight_capacity_tonnes'] ?? null,
                'volume_capacity_m3' => $typeData['volume_capacity_m3'] ?? null,
                'max_speed' => $typeData['max_speed'] ?? null,
                'max_passengers' => $typeData['max_passengers'] ?? null,
                'hull' => $typeData['hull'] ?? null,
                'shield' => $typeData['shield'] ?? null,
                'ionic_capacity' => $typeData['ionic_capacity'] ?? null,
                'has_repulsors' => $typeData['has_repulsors'] ?? null,
                'slot_size' => $typeData['slot_size'] ?? null,
                'medical_rooms' => $typeData['medical_rooms'] ?? null,
                'has_hangar_bay' => $typeData['has_hangar_bay'] ?? null,
                'has_docking_bay' => $typeData['has_docking_bay'] ?? null,
                'can_recycle' => $typeData['can_recycle'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'production_modifier' => $typeData['production_modifier'] ?? null,
                'recommended_workers' => $typeData['recommended_workers'] ?? null,
                'recycling_xp' => $typeData['recycling_xp'] ?? null,
                'generic_slots' => $typeData['generic_slots'] ?? null,
                'terrain_restrictions' => $typeData['terrain_restrictions'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'materials' => $typeData['materials'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'vehicle_type',
            'persisted' => true,
            'vehicle_type_uid' => $type->uid,
            'vehicle_type_id' => $type->id,
        ];
    }

    protected function persistNpcTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['npc_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('NPC type payload could not be persisted without a UID.');
        }

        $type = SwcNpcType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'hiring_locations' => $typeData['hiring_locations'] ?? null,
                'skills' => $typeData['skills'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'npc_type',
            'persisted' => true,
            'npc_type_uid' => $type->uid,
            'npc_type_id' => $type->id,
        ];
    }

    protected function persistDroidTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['droid_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Droid type payload could not be persisted without a UID.');
        }

        $type = SwcDroidType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'sensors' => $typeData['sensors'] ?? null,
                'ecm' => $typeData['ecm'] ?? null,
                'batch_quantity' => $typeData['batch_quantity'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'weight_capacity_tonnes' => $typeData['weight_capacity_tonnes'] ?? null,
                'volume_capacity_m3' => $typeData['volume_capacity_m3'] ?? null,
                'hull' => $typeData['hull'] ?? null,
                'shield' => $typeData['shield'] ?? null,
                'ionic_capacity' => $typeData['ionic_capacity'] ?? null,
                'armour' => $typeData['armour'] ?? null,
                'slot_size' => $typeData['slot_size'] ?? null,
                'terrain_restrictions' => $typeData['terrain_restrictions'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'production_modifier' => $typeData['production_modifier'] ?? null,
                'recommended_workers' => $typeData['recommended_workers'] ?? null,
                'recycling_xp' => $typeData['recycling_xp'] ?? null,
                'generic_slots' => $typeData['generic_slots'] ?? null,
                'skills' => $typeData['skills'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'materials' => $typeData['materials'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'droid_type',
            'persisted' => true,
            'droid_type_uid' => $type->uid,
            'droid_type_id' => $type->id,
        ];
    }

    protected function persistRacePayload(array $payload): array
    {
        $typeData = (array) ($payload['race'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Race payload could not be persisted without a UID.');
        }

        $type = SwcRace::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'force_probability' => $typeData['force_probability'] ?? null,
                'hp_bonus' => $typeData['hp_bonus'] ?? null,
                'hp_multiplier' => $typeData['hp_multiplier'] ?? null,
                'homeworld_uid' => $typeData['homeworld_uid'] ?? null,
                'homeworld_name' => $typeData['homeworld_name'] ?? null,
                'homeworld_href' => $typeData['homeworld_href'] ?? null,
                'skills' => $typeData['skills'] ?? null,
                'terrain_restrictions' => $typeData['terrain_restrictions'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'race',
            'persisted' => true,
            'race_uid' => $type->uid,
            'race_id' => $type->id,
        ];
    }

    protected function persistWeaponTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['weapon_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Weapon type payload could not be persisted without a UID.');
        }

        $type = SwcWeaponType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'damage_type' => $typeData['damage_type'] ?? null,
                'min_damage' => $typeData['min_damage'] ?? null,
                'max_damage' => $typeData['max_damage'] ?? null,
                'optimum_range' => $typeData['optimum_range'] ?? null,
                'max_hits' => $typeData['max_hits'] ?? null,
                'drop_off' => $typeData['drop_off'] ?? null,
                'firepower' => $typeData['firepower'] ?? null,
                'tracking' => $typeData['tracking'] ?? null,
                'is_poison' => $typeData['is_poison'] ?? null,
                'is_dual' => $typeData['is_dual'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'weapon_type',
            'persisted' => true,
            'weapon_type_uid' => $type->uid,
            'weapon_type_id' => $type->id,
        ];
    }

    protected function persistCreatureTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['creature_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Creature type payload could not be persisted without a UID.');
        }

        $type = SwcCreatureType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'class_name' => $typeData['class_name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'slot_size' => $typeData['slot_size'] ?? null,
                'species' => $typeData['species'] ?? null,
                'base_hp' => $typeData['base_hp'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'homeworld_uid' => $typeData['homeworld_uid'] ?? null,
                'homeworld_name' => $typeData['homeworld_name'] ?? null,
                'homeworld_href' => $typeData['homeworld_href'] ?? null,
                'spawn_terrain_types' => $typeData['spawn_terrain_types'] ?? null,
                'terrain_restrictions' => $typeData['terrain_restrictions'] ?? null,
                'skills' => $typeData['skills'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'icon_url' => $typeData['icon_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'creature_type',
            'persisted' => true,
            'creature_type_uid' => $type->uid,
            'creature_type_id' => $type->id,
        ];
    }

    protected function persistStationTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['station_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Station type payload could not be persisted without a UID.');
        }

        $type = SwcStationType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'length' => $typeData['length'] ?? null,
                'description' => $typeData['description'] ?? null,
                'sensors' => $typeData['sensors'] ?? null,
                'ecm' => $typeData['ecm'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'weight_capacity_tonnes' => $typeData['weight_capacity_tonnes'] ?? null,
                'volume_capacity_m3' => $typeData['volume_capacity_m3'] ?? null,
                'max_passengers' => $typeData['max_passengers'] ?? null,
                'escape_pods' => $typeData['escape_pods'] ?? null,
                'hull' => $typeData['hull'] ?? null,
                'shield' => $typeData['shield'] ?? null,
                'ionic_capacity' => $typeData['ionic_capacity'] ?? null,
                'medical_rooms' => $typeData['medical_rooms'] ?? null,
                'has_hangar_bay' => $typeData['has_hangar_bay'] ?? null,
                'has_docking_bay' => $typeData['has_docking_bay'] ?? null,
                'can_recycle' => $typeData['can_recycle'] ?? null,
                'can_produce' => $typeData['can_produce'] ?? null,
                'is_asteroid_mining_depot' => $typeData['is_asteroid_mining_depot'] ?? null,
                'can_refine_alazhi' => $typeData['can_refine_alazhi'] ?? null,
                'can_interdict' => $typeData['can_interdict'] ?? null,
                'can_research' => $typeData['can_research'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'production_modifier' => $typeData['production_modifier'] ?? null,
                'recommended_workers' => $typeData['recommended_workers'] ?? null,
                'recycling_xp' => $typeData['recycling_xp'] ?? null,
                'generic_slots' => $typeData['generic_slots'] ?? null,
                'weapons' => $typeData['weapons'] ?? null,
                'materials' => $typeData['materials'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'station_type',
            'persisted' => true,
            'station_type_uid' => $type->uid,
            'station_type_id' => $type->id,
        ];
    }

    protected function persistTerrainTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['terrain_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcTerrainType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'terrain_type_index',
            'persisted' => true,
            'terrain_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistTerrainTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['terrain_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Terrain type payload could not be persisted without a UID.');
        }

        $type = SwcTerrainType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'code' => $typeData['code'] ?? null,
                'material_probability_percent' => $typeData['material_probability_percent'] ?? null,
                'material_types' => $typeData['material_types'] ?? null,
                'images' => $typeData['images'] ?? null,
                'description' => $typeData['description'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        $this->syncMaterialTypesForTerrain($typeData);

        return [
            'resource' => 'terrain_type',
            'persisted' => true,
            'terrain_type_uid' => $type->uid,
            'terrain_type_id' => $type->id,
        ];
    }

    protected function persistMaterialTypeIndexPayload(array $payload): array
    {
        $items = collect($payload['material_types'] ?? []);
        $persisted = 0;

        foreach ($items as $item) {
            if (!is_array($item) || empty($item['uid'])) {
                continue;
            }

            SwcMaterialType::updateOrCreate(
                ['uid' => (string) $item['uid']],
                [
                    'name' => $item['name'] ?? null,
                    'last_pulled_at' => now(),
                ]
            );

            $persisted += 1;
        }

        return [
            'resource' => 'material_type_index',
            'persisted' => true,
            'material_type_count' => $persisted,
            'pages' => $payload['meta']['pages'] ?? null,
            'total' => $payload['meta']['total'] ?? $persisted,
        ];
    }

    protected function persistMaterialTypePayload(array $payload): array
    {
        $typeData = (array) ($payload['material_type'] ?? []);
        $uid = (string) ($typeData['uid'] ?? $payload['identifier'] ?? '');

        if ($uid === '') {
            throw new \RuntimeException('Material type payload could not be persisted without a UID.');
        }

        $type = SwcMaterialType::updateOrCreate(
            ['uid' => $uid],
            [
                'name' => $typeData['name'] ?? null,
                'description' => $typeData['description'] ?? null,
                'weight_tonnes' => $typeData['weight_tonnes'] ?? null,
                'volume_m3' => $typeData['volume_m3'] ?? null,
                'rarity' => $typeData['rarity'] ?? null,
                'price_credits' => $typeData['price_credits'] ?? null,
                'images' => $typeData['images'] ?? null,
                'image_url' => $typeData['image_url'] ?? null,
                'payload' => $typeData['payload'] ?? null,
                'last_pulled_at' => now(),
            ]
        );

        return [
            'resource' => 'material_type',
            'persisted' => true,
            'material_type_uid' => $type->uid,
            'material_type_id' => $type->id,
        ];
    }

    protected function syncTerrainTypesForPlanet(array $planetData): void
    {
        foreach ((array) ($planetData['terrain_grid'] ?? []) as $terrainPoint) {
            if (!is_array($terrainPoint)) {
                continue;
            }

            $identifier = $this->resolveTerrainTypeIdentifier($terrainPoint);
            if ($identifier === null) {
                continue;
            }

            $knownTerrain = $this->findKnownTerrainType($terrainPoint);

            $isFresh = $knownTerrain?->last_pulled_at !== null
                && $knownTerrain->last_pulled_at->greaterThan(now()->subDay());

            if ($knownTerrain && $isFresh) {
                continue;
            }

            $payload = $this->universePullService->pull('terrain_type', $identifier);
            $this->persistTerrainTypePayload($payload);
        }
    }

    protected function syncMaterialTypesForTerrain(array $terrainTypeData): void
    {
        foreach ((array) ($terrainTypeData['material_types'] ?? []) as $materialType) {
            if (!is_array($materialType)) {
                continue;
            }

            $identifier = $this->resolveMaterialTypeIdentifier($materialType);
            if ($identifier === null) {
                continue;
            }

            $knownMaterial = $this->findKnownMaterialType($materialType);

            $isFresh = $knownMaterial?->last_pulled_at !== null
                && $knownMaterial->last_pulled_at->greaterThan(now()->subDay());

            if ($knownMaterial && $isFresh) {
                continue;
            }

            $payload = $this->universePullService->pull('material_type', $identifier);
            $this->persistMaterialTypePayload($payload);
        }
    }

    protected function resolveTerrainTypeIdentifier(array $terrainPoint): ?string
    {
        return $this->extractIdentifierFromHref($terrainPoint['href'] ?? null)
            ?? $this->firstNonEmptyIdentifier($terrainPoint, ['uid', 'code'])
            ?? $this->firstNonEmptyIdentifier($terrainPoint, ['name']);
    }

    protected function resolveMaterialTypeIdentifier(array $materialType): ?string
    {
        return $this->extractIdentifierFromHref($materialType['href'] ?? null)
            ?? $this->firstNonEmptyIdentifier($materialType, ['uid'])
            ?? $this->firstNonEmptyIdentifier($materialType, ['name']);
    }

    protected function findKnownTerrainType(array $terrainPoint): ?SwcTerrainType
    {
        $hrefIdentifier = $this->extractIdentifierFromHref($terrainPoint['href'] ?? null);
        if ($hrefIdentifier !== null) {
            $known = SwcTerrainType::query()
                ->where('uid', $hrefIdentifier)
                ->orWhere('code', $hrefIdentifier)
                ->orWhere('name', $hrefIdentifier)
                ->first();

            if ($known) {
                return $known;
            }
        }

        $uid = $this->firstNonEmptyIdentifier($terrainPoint, ['uid']);
        if ($uid !== null) {
            $known = SwcTerrainType::query()->where('uid', $uid)->first();
            if ($known) {
                return $known;
            }
        }

        $code = $this->firstNonEmptyIdentifier($terrainPoint, ['code']);
        if ($code !== null) {
            $known = SwcTerrainType::query()->where('code', $code)->first();
            if ($known) {
                return $known;
            }
        }

        $name = $this->firstNonEmptyIdentifier($terrainPoint, ['name']);
        if ($name !== null) {
            return SwcTerrainType::query()->where('name', $name)->first();
        }

        return null;
    }

    protected function findKnownMaterialType(array $materialType): ?SwcMaterialType
    {
        $hrefIdentifier = $this->extractIdentifierFromHref($materialType['href'] ?? null);
        if ($hrefIdentifier !== null) {
            $known = SwcMaterialType::query()
                ->where('uid', $hrefIdentifier)
                ->orWhere('name', $hrefIdentifier)
                ->first();

            if ($known) {
                return $known;
            }
        }

        $uid = $this->firstNonEmptyIdentifier($materialType, ['uid']);
        if ($uid !== null) {
            $known = SwcMaterialType::query()->where('uid', $uid)->first();
            if ($known) {
                return $known;
            }
        }

        $name = $this->firstNonEmptyIdentifier($materialType, ['name']);
        if ($name !== null) {
            return SwcMaterialType::query()->where('name', $name)->first();
        }

        return null;
    }

    protected function extractIdentifierFromHref(mixed $href): ?string
    {
        $value = trim((string) $href);
        if ($value === '') {
            return null;
        }

        $path = parse_url($value, PHP_URL_PATH);
        if (!is_string($path)) {
            return null;
        }

        $trimmed = trim($path, '/');
        $segments = $trimmed !== '' ? explode('/', $trimmed) : [];
        $last = end($segments);

        return is_string($last) && $last !== '' ? rawurldecode($last) : null;
    }

    protected function firstNonEmptyIdentifier(array $data, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = trim((string) ($data[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    protected function findOrCreateSectorShell(array $data): ?SwcSector
    {
        $uid = (string) ($data['sector_uid'] ?? '');
        if ($uid === '') {
            return null;
        }

        $sector = SwcSector::query()->where('uid', $uid)->first();
        if ($sector) {
            return $sector;
        }

        return $this->upsertSectorRecord(
            $uid,
            [
                'name' => $data['sector_name'] ?? null,
                'owner_uid' => $data['owner_uid'] ?? null,
                'owner_name' => $data['owner_name'] ?? null,
                'population' => $data['population'] ?? null,
                'known_systems' => $data['known_systems'] ?? null,
                'last_pulled_at' => now(),
            ]
        );
    }

    protected function upsertSectorRecord(string $uid, array $attributes): SwcSector
    {
        $attempts = 0;

        beginning:
        try {
            return SwcSector::updateOrCreate(['uid' => $uid], $attributes);
        } catch (QueryException $exception) {
            $attempts++;

            if ($attempts < 3 && $this->isRetryableLockException($exception)) {
                usleep(150000 * $attempts);
                goto beginning;
            }

            throw $exception;
        }
    }

    protected function isRetryableLockException(QueryException $exception): bool
    {
        $message = $exception->getMessage();

        return str_contains($message, 'Lock wait timeout exceeded')
            || str_contains($message, 'Deadlock found when trying to get lock');
    }

    protected function isSkippableSwcNotFoundException(\Throwable $exception): bool
    {
        return str_contains($exception->getMessage(), 'SWC request failed with status 404');
    }

    protected function findOrCreateSystemShell(array $data, ?SwcSector $sector): ?SwcSystem
    {
        $uid = (string) ($data['system_uid'] ?? '');
        if ($uid === '') {
            return null;
        }

        $system = SwcSystem::firstOrNew(['uid' => $uid]);
        $system->identifier = $system->identifier ?: $uid;
        $system->name = $data['system_name'] ?? $system->name;
        $system->sector_id = $sector?->id ?? $system->sector_id;
        $system->sector_uid = $data['sector_uid'] ?? $sector?->uid ?? $system->sector_uid;
        $system->sector_name = $data['sector_name'] ?? $sector?->name ?? $system->sector_name;
        $system->galx = $data['galx'] ?? $system->galx;
        $system->galy = $data['galy'] ?? $system->galy;
        $system->save();

        return $system;
    }

    protected function upsertSystem(array $data, ?SwcSector $sector, ?string $fallbackIdentifier = null): ?SwcSystem
    {
        $uid = (string) ($data['uid'] ?? '');
        if ($uid === '') {
            return null;
        }

        [$ownerUid, $ownerName] = $this->normalizeSystemOwner(
            $data['owner_uid'] ?? null,
            $data['owner_name'] ?? null
        );

        $system = SwcSystem::firstOrNew(['uid' => $uid]);
        $system->identifier = $data['identifier'] ?? $fallbackIdentifier ?: $uid;
        $system->name = $data['name'] ?? $system->name;
        $system->sector_id = $sector?->id ?? $system->sector_id;
        $system->sector_uid = $data['sector_uid'] ?? $sector?->uid ?? $system->sector_uid;
        $system->sector_name = $data['sector_name'] ?? $sector?->name ?? $system->sector_name;
        if (array_key_exists('owner_uid', $data) || array_key_exists('owner_name', $data)) {
            $system->owner_uid = $ownerUid;
            $system->owner_name = $ownerName;
        }
        $system->galx = $data['galx'] ?? $system->galx;
        $system->galy = $data['galy'] ?? $system->galy;
        $system->sysx = $data['sysx'] ?? $system->sysx;
        $system->sysy = $data['sysy'] ?? $system->sysy;
        $system->last_pulled_at = now();
        $system->save();

        return $system;
    }

    protected function normalizeSystemOwner(mixed $ownerUid, mixed $ownerName): array
    {
        $uid = is_string($ownerUid) ? trim($ownerUid) : '';
        $name = is_string($ownerName) ? trim($ownerName) : '';

        // Systems should only ever be owned by factions, never individual characters.
        if ($uid !== '' && str_starts_with($uid, '20:')) {
            return [$uid, $name !== '' ? $name : null];
        }

        return [null, null];
    }

    protected function upsertPlanet(
        array $data,
        ?SwcSector $sector,
        ?SwcSystem $system,
        ?string $fallbackIdentifier = null
    ): ?SwcPlanet {
        $uid = (string) ($data['uid'] ?? '');
        if ($uid === '') {
            return null;
        }

        $planet = SwcPlanet::firstOrNew(['uid' => $uid]);
        $planet->identifier = $data['identifier'] ?? $fallbackIdentifier ?: $uid;
        $planet->name = $data['name'] ?? $planet->name;
        $planet->sector_id = $sector?->id ?? $planet->sector_id;
        $planet->system_id = $system?->id ?? $planet->system_id;
        $planet->sector_uid = $data['sector_uid'] ?? $sector?->uid ?? $planet->sector_uid;
        $planet->sector_name = $data['sector_name'] ?? $sector?->name ?? $planet->sector_name;
        $planet->system_uid = $data['system_uid'] ?? $system?->uid ?? $planet->system_uid;
        $planet->system_name = $data['system_name'] ?? $system?->name ?? $planet->system_name;
        $planet->galx = $data['galx'] ?? $planet->galx;
        $planet->galy = $data['galy'] ?? $planet->galy;
        $planet->sysx = $data['sysx'] ?? $planet->sysx;
        $planet->sysy = $data['sysy'] ?? $planet->sysy;
        $planet->owner_uid = $data['owner_uid'] ?? $planet->owner_uid;
        $planet->owner_name = $data['owner_name'] ?? $planet->owner_name;
        $planet->planet_type_uid = $data['planet_type_uid'] ?? $planet->planet_type_uid;
        $planet->planet_type_name = $data['planet_type_name'] ?? $planet->planet_type_name;
        $planet->planet_type_href = $data['planet_type_href'] ?? $planet->planet_type_href;
        $planet->size = $data['size'] ?? $planet->size;
        $this->applyPlanetPopulationUpdate($planet, $data);
        $planet->terrain_map = $data['terrain_map'] ?? $planet->terrain_map;
        $planet->surface_bounds = $data['surface_bounds'] ?? $planet->surface_bounds;
        $planet->terrain_grid = $data['terrain_grid'] ?? $planet->terrain_grid;
        $planet->cities = $data['cities'] ?? $planet->cities;
        $planet->image_small_url = $data['image_small_url'] ?? $planet->image_small_url;
        $planet->image_large_url = $data['image_large_url'] ?? $planet->image_large_url;
        $planet->image_atmosphere_url = $data['image_atmosphere_url'] ?? $planet->image_atmosphere_url;
        $planet->image_stratosphere_url = $data['image_stratosphere_url'] ?? $planet->image_stratosphere_url;
        $planet->image_loworbit_url = $data['image_loworbit_url'] ?? $planet->image_loworbit_url;
        $planet->last_pulled_at = now();
        $planet->save();

        return $planet;
    }

    protected function applyPlanetPopulationUpdate(SwcPlanet $planet, array $data): void
    {
        if (!array_key_exists('population', $data) || $data['population'] === null) {
            return;
        }

        $nextPopulation = is_numeric($data['population'])
            ? (int) $data['population']
            : null;

        if ($nextPopulation === null) {
            return;
        }

        if ($planet->population !== null && (int) $planet->population !== $nextPopulation) {
            $planet->previous_population = (int) $planet->population;
            $planet->previous_population_recorded_at = now();
        }

        $planet->population = $nextPopulation;
    }

    protected function upsertStation(
        array $data,
        ?SwcSector $sector,
        ?SwcSystem $system,
        ?string $fallbackIdentifier = null
    ): ?SwcStation {
        $uid = (string) ($data['uid'] ?? '');
        if ($uid === '') {
            return null;
        }

        $stationType = null;
        $typeName = trim((string) ($data['type_name'] ?? '')) ?: null;
        if ($typeName !== null) {
            $stationType = SwcStationType::query()->where('name', $typeName)->first();
        }

        $station = SwcStation::firstOrNew(['uid' => $uid]);
        $station->identifier = $data['identifier'] ?? $fallbackIdentifier ?: $uid;
        $station->name = $data['name'] ?? $station->name;
        $station->type_name = $typeName ?? $station->type_name;
        $station->station_type_id = $stationType?->id ?? $station->station_type_id;
        $station->sector_id = $sector?->id ?? $station->sector_id;
        $station->system_id = $system?->id ?? $station->system_id;
        $station->sector_uid = $data['sector_uid'] ?? $sector?->uid ?? $station->sector_uid;
        $station->sector_name = $data['sector_name'] ?? $sector?->name ?? $station->sector_name;
        $station->system_uid = $data['system_uid'] ?? $system?->uid ?? $station->system_uid;
        $station->system_name = $data['system_name'] ?? $system?->name ?? $station->system_name;
        $station->galx = $data['galx'] ?? $station->galx;
        $station->galy = $data['galy'] ?? $station->galy;
        $station->sysx = $data['sysx'] ?? $station->sysx;
        $station->sysy = $data['sysy'] ?? $station->sysy;
        $station->owner_uid = $data['owner_uid'] ?? $station->owner_uid;
        $station->owner_name = $data['owner_name'] ?? $station->owner_name;
        $station->last_pulled_at = now();
        $station->save();

        return $station;
    }

    protected function upsertHyperlane(array $data, SwcSystem $system): ?SwcHyperlane
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            return null;
        }

        return SwcHyperlane::updateOrCreate(
            [
                'source_system_uid' => $system->uid,
                'name' => $name,
            ],
            [
                'uid' => $data['uid'] ?? null,
                'source_system_id' => $system->id,
                'destination_uid' => $data['destination_uid'] ?? null,
                'destination_name' => $data['destination_name'] ?? null,
                'destination_galx' => $data['destination_galx'] ?? null,
                'destination_galy' => $data['destination_galy'] ?? null,
                'owner_name' => $data['owner_name'] ?? null,
                'blocks' => $data['blocks'] ?? null,
                'modifier' => $data['modifier'] ?? null,
                'last_pulled_at' => now(),
            ]
        );
    }
}
