<?php

namespace App\Support\Swc;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

class UniversePullService
{
    public function pull(string $resource, string $identifier): array
    {
        $identifier = $this->normalizeIdentifier($identifier);

        return match ($resource) {
            'system' => $this->pullSystem($identifier, true),
            'sector' => $this->pullSector($identifier),
            'planet' => $this->pullPlanet($identifier),
            'station' => $this->pullStation($identifier),
            'item_type' => $this->pullItemType($identifier),
            'facility_type' => $this->pullFacilityType($identifier),
            'ship_type' => $this->pullShipType($identifier),
            'station_type' => $this->pullStationType($identifier),
            'terrain_type' => $this->pullTerrainType($identifier),
            'material_type' => $this->pullMaterialType($identifier),
            default => throw new \InvalidArgumentException('Unsupported resource type.'),
        };
    }

    public function pullAllFacilityTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('facilities', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'facility_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'facility_types' => $items,
        ];
    }

    public function pullAllItemTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('items', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'item_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'item_types' => $items,
        ];
    }

    public function pullAllShipTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('ships', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'ship_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'ship_types' => $items,
        ];
    }

    public function pullAllStationTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('stations', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'station_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'station_types' => $items,
        ];
    }

    public function pullAllTerrainTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('terrain', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'terrain_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'terrain_types' => $items,
        ];
    }

    public function pullAllMaterialTypesIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullTypeIndexPage('materials', $startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['items'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'material_type_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'material_types' => $items,
        ];
    }

    public function pullAllSectorsIndex(): array
    {
        $startIndex = 1;
        $itemCount = 50;
        $total = null;
        $items = [];
        $pages = 0;

        do {
            $page = $this->pullSectorIndexPage($startIndex, $itemCount);
            $pages += 1;
            $items = [...$items, ...($page['sectors'] ?? [])];
            $meta = $page['meta'] ?? [];
            $total = $meta['total'] ?? $total;
            $startIndex += $itemCount;
        } while ($total !== null && count($items) < $total);

        return [
            'resource' => 'sector_index',
            'meta' => [
                'total' => $total ?? count($items),
                'item_count' => count($items),
                'pages' => $pages,
                'page_size' => $itemCount,
            ],
            'sectors' => $items,
        ];
    }

    protected function pullSystem(string $identifier, bool $noTimeout = false): array
    {
        $xml = $this->fetchXml('/galaxy/systems/' . $this->encodeIdentifierPath($identifier), $noTimeout ? 0 : null);
        $systemNode = $xml->system ?? null;

        if (!$systemNode) {
            throw new \RuntimeException('System payload did not include a <system> node.');
        }
        $parsedSystem = $this->parseSystemNode($systemNode);

        $hyperlanes = [];
        if (isset($systemNode->hyperlanes) && isset($systemNode->hyperlanes->hyperlane)) {
            foreach ($systemNode->hyperlanes->hyperlane as $hyperlane) {
                $laneName = trim((string) $hyperlane);
                $destinationUid = trim((string) ($hyperlane['destination'] ?? '')) ?: null;
                $destinationX = $this->toIntOrNull($hyperlane['destinationX'] ?? null);
                $destinationY = $this->toIntOrNull($hyperlane['destinationY'] ?? null);

                $hyperlanes[] = [
                    'uid' => trim((string) ($hyperlane->uid ?? $hyperlane['uid'] ?? '')) ?: null,
                    'name' => $laneName !== '' ? $laneName : null,
                    'destination_uid' => $destinationUid,
                    'destination_name' => $this->inferHyperlaneDestinationName($laneName),
                    'destination_galx' => $destinationX,
                    'destination_galy' => $destinationY,
                    'owner_name' => trim((string) ($hyperlane['owner'] ?? '')) ?: null,
                    'blocks' => $this->toIntOrNull($hyperlane['blocks'] ?? null),
                    'modifier' => $this->toFloatOrNull($hyperlane['modifier'] ?? null),
                ];
            }
        }

        $planetStubs = [];
        if (isset($systemNode->planets) && isset($systemNode->planets->planet)) {
            foreach ($systemNode->planets->planet as $planet) {
                $href = trim((string) ($planet['href'] ?? '')) ?: null;
                $identifier = $this->resolveEntityIdentifier(
                    trim((string) ($planet->uid ?? $planet['uid'] ?? '')) ?: null,
                    $href
                );

                $planetStubs[] = [
                    'uid' => trim((string) ($planet->uid ?? $planet['uid'] ?? '')) ?: null,
                    'name' => trim((string) ($planet['name'] ?? $planet->name ?? $planet)) ?: null,
                    'href' => $href,
                    'identifier' => $identifier,
                    'galx' => null,
                    'galy' => null,
                    'sysx' => null,
                    'sysy' => null,
                    'image_small_url' => null,
                    'image_large_url' => null,
                ];
            }
        }

        $stationStubs = [];
        if (isset($systemNode->stations) && isset($systemNode->stations->station)) {
            foreach ($systemNode->stations->station as $station) {
                $href = trim((string) ($station['href'] ?? '')) ?: null;
                $identifier = $this->resolveEntityIdentifier(
                    trim((string) ($station->uid ?? $station['uid'] ?? '')) ?: null,
                    $href
                );

                $stationStubs[] = [
                    'uid' => trim((string) ($station->uid ?? $station['uid'] ?? '')) ?: null,
                    'name' => trim((string) ($station['name'] ?? $station->name ?? $station)) ?: null,
                    'href' => $href,
                    'identifier' => $identifier,
                    'type_name' => null,
                    'galx' => null,
                    'galy' => null,
                    'sysx' => null,
                    'sysy' => null,
                ];
            }
        }

        return [
            'resource' => 'system',
            'identifier' => $identifier,
            'system' => $parsedSystem,
            'planet_stubs' => $planetStubs,
            'station_stubs' => $stationStubs,
            'hyperlanes' => $hyperlanes,
        ];
    }

    protected function pullSector(string $identifier): array
    {
        $xml = $this->fetchXml('/galaxy/sectors/' . $this->encodeIdentifierPath($identifier));
        $sectorNode = $xml->sector ?? null;

        if (!$sectorNode) {
            throw new \RuntimeException('Sector payload did not include a <sector> node.');
        }

        $sectorUid = trim((string) ($sectorNode->uid ?? $sectorNode['uid'] ?? ''));
        $sectorName = trim((string) ($sectorNode->name ?? ''));
        $ownerUid = isset($sectorNode->controlledby)
            ? trim((string) ($sectorNode->controlledby['uid'] ?? '')) ?: null
            : null;
        $ownerName = isset($sectorNode->controlledby)
            ? trim((string) $sectorNode->controlledby) ?: null
            : null;
        $population = $this->toIntOrNull($sectorNode->population ?? null);
        $colorR = isset($sectorNode->colour->r) ? $this->toIntOrNull($sectorNode->colour->r) : null;
        $colorG = isset($sectorNode->colour->g) ? $this->toIntOrNull($sectorNode->colour->g) : null;
        $colorB = isset($sectorNode->colour->b) ? $this->toIntOrNull($sectorNode->colour->b) : null;
        $colorHex = null;
        if ($colorR !== null && $colorG !== null && $colorB !== null) {
            $colorHex = sprintf('#%02X%02X%02X', $colorR, $colorG, $colorB);
        }

        $coordinates = [];
        if (isset($sectorNode->coordinates) && isset($sectorNode->coordinates->point)) {
            foreach ($sectorNode->coordinates->point as $point) {
                $x = $this->toIntOrNull($point['x'] ?? null);
                $y = $this->toIntOrNull($point['y'] ?? null);

                if ($x !== null && $y !== null) {
                    $coordinates[] = ['galx' => $x, 'galy' => $y];
                }
            }
        }

        $systems = [];
        if (isset($sectorNode->systems) && isset($sectorNode->systems->system)) {
            foreach ($sectorNode->systems->system as $system) {
                $href = trim((string) ($system['href'] ?? '')) ?: null;
                $fallbackName = trim((string) ($system->name ?? $system)) ?: null;
                $resolvedIdentifier = $this->resolveSystemIdentifier(
                    trim((string) ($system->uid ?? $system['uid'] ?? '')) ?: null,
                    $href
                );

                $systems[] = [
                    'uid' => trim((string) ($system->uid ?? $system['uid'] ?? '')) ?: null,
                    'name' => $fallbackName,
                    'href' => $href,
                    'identifier' => $resolvedIdentifier,
                    'galx' => null,
                    'galy' => null,
                    'sysx' => null,
                    'sysy' => null,
                ];
            }
        }

        $bounds = null;
        if ($coordinates !== []) {
            $xs = array_column($coordinates, 'galx');
            $ys = array_column($coordinates, 'galy');
        } else {
            $xs = [];
            $ys = [];
        }

        if ($xs !== [] && $ys !== []) {
            $bounds = [
                'min_galx' => min($xs),
                'max_galx' => max($xs),
                'min_galy' => min($ys),
                'max_galy' => max($ys),
                'width' => (max($xs) - min($xs)) + 1,
                'height' => (max($ys) - min($ys)) + 1,
            ];
        }

        return [
            'resource' => 'sector',
            'identifier' => $identifier,
            'sector' => [
                'uid' => $sectorUid !== '' ? $sectorUid : null,
                'name' => $sectorName !== '' ? $sectorName : null,
                'owner_uid' => $ownerUid,
                'owner_name' => $ownerName,
                'population' => $population,
                'known_systems' => count($systems),
                'coordinate_count' => count($coordinates),
                'system_count' => count($systems),
                'color_r' => $colorR,
                'color_g' => $colorG,
                'color_b' => $colorB,
                'color_hex' => $colorHex,
            ],
            'outline_coordinates' => $coordinates,
            'bounds' => $bounds,
            'coordinates' => $coordinates,
            'systems' => $systems,
        ];
    }

    protected function pullPlanet(string $identifier, ?int $timeoutSeconds = null): array
    {
        $xml = $this->fetchXml('/galaxy/planets/' . $this->encodeIdentifierPath($identifier) . '/', $timeoutSeconds);
        $planetNode = $xml->planet ?? null;

        if (!$planetNode) {
            throw new \RuntimeException('Planet payload did not include a <planet> node.');
        }

        $planetUid = trim((string) ($planetNode->uid ?? ''));
        $planetName = trim((string) ($planetNode->name ?? ''));
        $location = isset($planetNode->location)
            ? $this->parseLocationNode($planetNode->location)
            : [];

        $ownerUid = isset($planetNode->controlledby) ? trim((string) ($planetNode->controlledby['uid'] ?? '')) ?: null : null;
        $ownerName = isset($planetNode->controlledby) ? trim((string) $planetNode->controlledby) ?: null : null;

        $imageSmall = null;
        $imageLarge = null;
        $imageAtmosphere = null;
        $imageStratosphere = null;
        $imageLoworbit = null;
        $terrainMap = null;
        $planetSize = $this->toIntOrNull($planetNode->size ?? null);
        $population = $this->toIntOrNull($planetNode->population ?? null);
        $surfaceBounds = null;
        $terrainGrid = [];
        $cities = [];
        if (isset($planetNode->images)) {
            $imageSmall = trim((string) ($planetNode->images->small ?? '')) ?: null;
            $imageLarge = trim((string) ($planetNode->images->large ?? '')) ?: null;
            $imageAtmosphere = trim((string) ($planetNode->images->atmosphere ?? '')) ?: null;
            $imageStratosphere = trim((string) ($planetNode->images->stratosphere ?? '')) ?: null;
            $imageLoworbit = trim((string) ($planetNode->images->loworbit ?? '')) ?: null;
        }
        if (isset($planetNode->terrainmap)) {
            $terrainMap = trim((string) $planetNode->terrainmap) ?: null;
        }
        if (isset($planetNode->grid) && isset($planetNode->grid->point)) {
            $minX = null;
            $maxX = null;
            $minY = null;
            $maxY = null;

            foreach ($planetNode->grid->point as $point) {
                $x = $this->toIntOrNull($point['x'] ?? null);
                $y = $this->toIntOrNull($point['y'] ?? null);

                if ($x === null || $y === null) {
                    continue;
                }

                $terrainGrid[] = [
                    'x' => $x,
                    'y' => $y,
                    'uid' => trim((string) ($point['uid'] ?? '')) ?: null,
                    'code' => trim((string) ($point['code'] ?? '')) ?: null,
                    'href' => trim((string) ($point['href'] ?? '')) ?: null,
                    'name' => trim((string) $point) ?: null,
                ];

                $minX = $minX === null ? $x : min($minX, $x);
                $maxX = $maxX === null ? $x : max($maxX, $x);
                $minY = $minY === null ? $y : min($minY, $y);
                $maxY = $maxY === null ? $y : max($maxY, $y);
            }

            if ($minX !== null && $maxX !== null && $minY !== null && $maxY !== null) {
                $surfaceBounds = [
                    'min_x' => $minX,
                    'max_x' => $maxX,
                    'min_y' => $minY,
                    'max_y' => $maxY,
                    'width' => ($maxX - $minX) + 1,
                    'height' => ($maxY - $minY) + 1,
                ];
            }
        }
        if (isset($planetNode->cities) && isset($planetNode->cities->city)) {
            foreach ($planetNode->cities->city as $city) {
                $x = $this->toIntOrNull($city['x'] ?? null);
                $y = $this->toIntOrNull($city['y'] ?? null);

                $cities[] = [
                    'uid' => trim((string) ($city['uid'] ?? '')) ?: null,
                    'name' => trim((string) ($city['name'] ?? $city)) ?: null,
                    'href' => trim((string) ($city['href'] ?? '')) ?: null,
                    'x' => $x,
                    'y' => $y,
                ];
            }
        }

        return [
            'resource' => 'planet',
            'identifier' => $identifier,
            'planet' => [
                'uid' => $planetUid !== '' ? $planetUid : null,
                'name' => $planetName !== '' ? $planetName : null,
                'system_uid' => $location['system_uid'] ?? null,
                'system_name' => $location['system_name'] ?? null,
                'sector_uid' => $location['sector_uid'] ?? null,
                'sector_name' => $location['sector_name'] ?? null,
                'galx' => $location['galx'] ?? null,
                'galy' => $location['galy'] ?? null,
                'sysx' => $location['sysx'] ?? null,
                'sysy' => $location['sysy'] ?? null,
                'owner_uid' => $ownerUid,
                'owner_name' => $ownerName,
                'size' => $planetSize,
                'population' => $population,
                'terrain_map' => $terrainMap,
                'surface_bounds' => $surfaceBounds,
                'terrain_grid' => $terrainGrid,
                'cities' => $cities,
                'image_small_url' => $imageSmall,
                'image_large_url' => $imageLarge,
                'image_atmosphere_url' => $imageAtmosphere,
                'image_stratosphere_url' => $imageStratosphere,
                'image_loworbit_url' => $imageLoworbit,
            ],
        ];
    }

    protected function pullStation(string $identifier, ?int $timeoutSeconds = null): array
    {
        $xml = $this->fetchXml('/galaxy/stations/' . $this->encodeIdentifierPath($identifier) . '/', $timeoutSeconds);
        $stationNode = $xml->station ?? null;

        if (!$stationNode) {
            throw new \RuntimeException('Station payload did not include a <station> node.');
        }

        $stationUid = trim((string) ($stationNode->uid ?? ''));
        $stationName = trim((string) ($stationNode->name ?? ''));
        $typeName = isset($stationNode->type) ? trim((string) $stationNode->type) ?: null : null;
        $ownerUid = isset($stationNode->owner) ? trim((string) ($stationNode->owner['uid'] ?? '')) ?: null : null;
        $ownerName = isset($stationNode->owner) ? trim((string) $stationNode->owner) ?: null : null;
        $location = isset($stationNode->location)
            ? $this->parseLocationNode($stationNode->location)
            : [];

        return [
            'resource' => 'station',
            'identifier' => $identifier,
            'station' => [
                'uid' => $stationUid !== '' ? $stationUid : null,
                'name' => $stationName !== '' ? $stationName : null,
                'type_name' => $typeName,
                'owner_uid' => $ownerUid,
                'owner_name' => $ownerName,
                'system_uid' => $location['system_uid'] ?? null,
                'system_name' => $location['system_name'] ?? null,
                'sector_uid' => $location['sector_uid'] ?? null,
                'sector_name' => $location['sector_name'] ?? null,
                'galx' => $location['galx'] ?? null,
                'galy' => $location['galy'] ?? null,
                'sysx' => $location['sysx'] ?? null,
                'sysy' => $location['sysy'] ?? null,
            ],
        ];
    }

    protected function pullStationType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/stations/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['station', 'stationtype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Station type payload did not include a station type node.');
        }

        return [
            'resource' => 'station_type',
            'identifier' => $identifier,
            'station_type' => $this->parseStationTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullShipType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/ships/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['ship', 'shiptype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Ship type payload did not include a ship type node.');
        }

        return [
            'resource' => 'ship_type',
            'identifier' => $identifier,
            'ship_type' => $this->parseShipTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullFacilityType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/facilities/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['facility', 'facilitytype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Facility type payload did not include a facility type node.');
        }

        return [
            'resource' => 'facility_type',
            'identifier' => $identifier,
            'facility_type' => $this->parseFacilityTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullItemType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/items/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['item', 'itemtype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Item type payload did not include an item type node.');
        }

        return [
            'resource' => 'item_type',
            'identifier' => $identifier,
            'item_type' => $this->parseItemTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullTerrainType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/terrain/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['terrain', 'terraintype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Terrain type payload did not include a terrain type node.');
        }

        return [
            'resource' => 'terrain_type',
            'identifier' => $identifier,
            'terrain_type' => $this->parseTerrainTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullMaterialType(string $identifier): array
    {
        $xml = $this->fetchXml('/types/materials/' . $this->encodeIdentifierPath($identifier) . '/');
        $typeNode = $this->extractTypeDetailNode($xml, ['material', 'materialtype', 'type']);

        if (!$typeNode) {
            throw new \RuntimeException('Material type payload did not include a material type node.');
        }

        return [
            'resource' => 'material_type',
            'identifier' => $identifier,
            'material_type' => $this->parseMaterialTypeNode($typeNode, $identifier),
        ];
    }

    protected function pullSectorIndexPage(int $startIndex = 1, int $itemCount = 50): array
    {
        $query = http_build_query([
            'start_index' => $startIndex,
            'item_count' => min(50, max(1, $itemCount)),
        ]);

        $xml = $this->fetchXml('/galaxy/sectors/?' . $query);
        $sectorsNode = $xml->sectors ?? null;

        if (!$sectorsNode) {
            throw new \RuntimeException('Sector index payload did not include a <sectors> node.');
        }

        $items = [];
        if (isset($sectorsNode->sector)) {
            foreach ($sectorsNode->sector as $sectorNode) {
                $href = trim((string) ($sectorNode['href'] ?? '')) ?: null;
                $items[] = [
                    'uid' => trim((string) ($sectorNode['uid'] ?? '')) ?: null,
                    'name' => trim((string) ($sectorNode['name'] ?? $sectorNode)) ?: null,
                    'href' => $href,
                    'identifier' => $this->resolveEntityIdentifier(
                        trim((string) ($sectorNode['uid'] ?? '')) ?: null,
                        $href
                    ),
                    'owner_uid' => isset($sectorNode->controlledby)
                        ? trim((string) ($sectorNode->controlledby['uid'] ?? '')) ?: null
                        : null,
                    'owner_name' => isset($sectorNode->controlledby)
                        ? trim((string) $sectorNode->controlledby) ?: null
                        : null,
                    'known_systems' => $this->toIntOrNull($sectorNode->knownsystems ?? null),
                    'population' => $this->toIntOrNull($sectorNode->population ?? null),
                ];
            }
        }

        return [
            'resource' => 'sector_index_page',
            'meta' => [
                'count' => $this->toIntOrNull($sectorsNode['count'] ?? null) ?? count($items),
                'start' => $this->toIntOrNull($sectorsNode['start'] ?? null) ?? $startIndex,
                'total' => $this->toIntOrNull($sectorsNode['total'] ?? null),
            ],
            'sectors' => $items,
        ];
    }

    protected function pullTypeIndexPage(string $entityType, int $startIndex = 1, int $itemCount = 50): array
    {
        $query = http_build_query([
            'start_index' => $startIndex,
            'item_count' => min(50, max(1, $itemCount)),
        ]);

        $xml = $this->fetchXml('/types/' . rawurlencode($entityType) . '/?' . $query);
        $collectionNode = $this->extractTypeCollectionNode($xml, [$entityType]);

        if (!$collectionNode) {
            throw new \RuntimeException("Type index payload did not include a <{$entityType}> collection node.");
        }

        $items = [];
        foreach ($collectionNode->children() as $child) {
            if (!$child instanceof \SimpleXMLElement) {
                continue;
            }

            $uid = trim((string) ($child['uid'] ?? $child->uid ?? '')) ?: null;
            $href = trim((string) ($child['href'] ?? '')) ?: null;
            $name = trim((string) ($child['name'] ?? $child->name ?? $child)) ?: null;

            if (!$uid && !$name) {
                continue;
            }

            $items[] = [
                'uid' => $uid,
                'name' => $name,
                'href' => $href,
                'identifier' => $this->resolveEntityIdentifier($uid, $href),
            ];
        }

        return [
            'resource' => 'type_index_page',
            'entity_type' => $entityType,
            'meta' => [
                'count' => $this->toIntOrNull($collectionNode['count'] ?? null) ?? count($items),
                'start' => $this->toIntOrNull($collectionNode['start'] ?? null) ?? $startIndex,
                'total' => $this->toIntOrNull($collectionNode['total'] ?? null),
            ],
            'items' => $items,
        ];
    }

    protected function fetchXml(string $path, ?int $timeoutSeconds = null): \SimpleXMLElement
    {
        $base = rtrim((string) Config::get('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $base . '/' . ltrim($path, '/');
        $connectTimeout = (int) Config::get('swc.http_connect_timeout', 30);
        $requestTimeout = $timeoutSeconds === 0
            ? 0
            : ($timeoutSeconds ?? (int) Config::get('swc.http_timeout', 120));
        $retryAttempts = max(1, (int) Config::get('swc.http_retry_attempts', 3));
        $retryBackoffMs = max(0, (int) Config::get('swc.http_retry_backoff_ms', 1000));

        $response = null;
        $lastException = null;

        for ($attempt = 1; $attempt <= $retryAttempts; $attempt++) {
            try {
                $request = Http::withHeaders([
                    'Accept' => 'application/xml, text/xml;q=0.9, */*;q=0.8',
                    'User-Agent' => (string) Config::get('swc.http_user_agent', 'JOE API Client'),
                ])->connectTimeout($connectTimeout);

                $request = $request->timeout($requestTimeout);
                $response = $request->get($url);

                if ($response->ok()) {
                    break;
                }

                if (!$this->shouldRetryHttpStatus($response->status()) || $attempt === $retryAttempts) {
                    throw new \RuntimeException("SWC request failed with status {$response->status()} for {$url}");
                }

                usleep($retryBackoffMs * 1000 * $attempt);
            } catch (ConnectionException $exception) {
                $lastException = $exception;

                if ($attempt === $retryAttempts || !$this->shouldRetryHttpException($exception)) {
                    throw $exception;
                }

                usleep($retryBackoffMs * 1000 * $attempt);
            }
        }

        if (!$response || !$response->ok()) {
            if ($lastException) {
                throw $lastException;
            }

            throw new \RuntimeException("SWC request failed for {$url}");
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($response->body());

        if ($xml === false) {
            $errors = array_map(
                static fn ($error) => trim((string) $error->message),
                libxml_get_errors()
            );
            libxml_clear_errors();

            throw new \RuntimeException(
                'Failed to parse SWC XML: ' . ($errors !== [] ? implode(' | ', $errors) : 'Unknown XML parse error.')
            );
        }

        $raw = $xml->asXML();

        if ($raw === false) {
            throw new \RuntimeException('Failed to serialize SWC XML.');
        }

        $clean = preg_replace('/xmlns="[^"]+"/', '', $raw, 1);

        if (!is_string($clean)) {
            throw new \RuntimeException('Failed to strip XML namespace.');
        }

        $cleanXml = simplexml_load_string($clean);

        if ($cleanXml === false) {
            throw new \RuntimeException('Failed to reload XML after namespace removal.');
        }

        return $cleanXml;
    }

    protected function shouldRetryHttpStatus(int $status): bool
    {
        return in_array($status, [408, 425, 429, 500, 502, 503, 504], true);
    }

    protected function shouldRetryHttpException(ConnectionException $exception): bool
    {
        $message = $exception->getMessage();

        return str_contains($message, 'cURL error 28')
            || str_contains($message, 'Connection timed out')
            || str_contains($message, 'Operation timed out')
            || str_contains($message, 'temporarily unavailable')
            || str_contains($message, 'Connection refused')
            || str_contains($message, 'Failed to connect');
    }

    protected function toIntOrNull(mixed $value): ?int
    {
        $string = trim((string) $value);

        if ($string === '' || !is_numeric($string)) {
            return null;
        }

        return (int) $string;
    }

    protected function toFloatOrNull(mixed $value): ?float
    {
        $string = trim((string) $value);

        if ($string === '' || !is_numeric($string)) {
            return null;
        }

        return (float) $string;
    }

    protected function toBoolOrNull(mixed $value): ?bool
    {
        $string = strtolower(trim((string) $value));

        return match ($string) {
            'yes', 'true', '1' => true,
            'no', 'false', '0' => false,
            '', 'null' => null,
            default => null,
        };
    }

    protected function inferHyperlaneDestinationName(?string $laneName): ?string
    {
        $name = trim((string) $laneName);
        if ($name === '') {
            return null;
        }

        if (preg_match('/\s+to\s+(.+?)\s+Hyperlane$/i', $name, $matches)) {
            return trim($matches[1]) ?: null;
        }

        return null;
    }

    protected function parseSystemNode(\SimpleXMLElement $systemNode): array
    {
        $systemUid = trim((string) ($systemNode->uid ?? ''));
        $systemName = trim((string) ($systemNode->name ?? ''));

        $sectorUid = null;
        $sectorName = null;
        $galx = null;
        $galy = null;
        $sysx = null;
        $sysy = null;

        if (isset($systemNode->location)) {
            $loc = $systemNode->location;

            if (isset($loc->sector)) {
                $sectorUid = trim((string) ($loc->sector['uid'] ?? '')) ?: null;
                $sectorName = trim((string) $loc->sector) ?: null;
            }

            if (isset($loc->coordinates)) {
                $coords = $loc->coordinates;

                if (isset($coords->galaxy)) {
                    $galx = $this->toIntOrNull($coords->galaxy['x'] ?? null);
                    $galy = $this->toIntOrNull($coords->galaxy['y'] ?? null);
                }

                if (isset($coords->system)) {
                    $sysx = $this->toIntOrNull($coords->system['x'] ?? null);
                    $sysy = $this->toIntOrNull($coords->system['y'] ?? null);
                }
            }
        }

        return [
            'uid' => $systemUid !== '' ? $systemUid : null,
            'name' => $systemName !== '' ? $systemName : null,
            'sector_uid' => $sectorUid,
            'sector_name' => $sectorName,
            'galx' => $galx,
            'galy' => $galy,
            'sysx' => $sysx,
            'sysy' => $sysy,
        ];
    }

    protected function resolveEntityIdentifier(?string $uid, ?string $href): ?string
    {
        if ($href) {
            $path = parse_url($href, PHP_URL_PATH);
            if (is_string($path)) {
                $trimmed = trim($path, '/');
                $segments = $trimmed !== '' ? explode('/', $trimmed) : [];
                $last = end($segments);
                if (is_string($last) && $last !== '') {
                    return $this->normalizeIdentifier($last);
                }
            }
        }

        return $uid ? $this->normalizeIdentifier($uid) : null;
    }

    protected function normalizeIdentifier(string $identifier): string
    {
        $normalized = trim($identifier);

        while ($normalized !== '') {
            $decoded = rawurldecode($normalized);

            if ($decoded === $normalized) {
                break;
            }

            $normalized = $decoded;
        }

        return $normalized;
    }

    protected function resolveSystemIdentifier(?string $uid, ?string $href): ?string
    {
        return $this->resolveEntityIdentifier($uid, $href);
    }

    protected function safeFetchSystemSummary(string $identifier): ?array
    {
        try {
            $xml = $this->fetchXml('/galaxy/systems/' . $this->encodeIdentifierPath($identifier));
            $systemNode = $xml->system ?? null;

            if (!$systemNode) {
                return null;
            }

            return $this->parseSystemNode($systemNode);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function safeFetchPlanetSummary(string $identifier, bool $noTimeout = false): ?array
    {
        try {
            return $this->pullPlanet($identifier, $noTimeout ? 0 : null)['planet'] ?? null;
        } catch (\Throwable) {
            return null;
        }
    }

    protected function safeFetchStationSummary(string $identifier, bool $noTimeout = false): ?array
    {
        try {
            return $this->pullStation($identifier, $noTimeout ? 0 : null)['station'] ?? null;
        } catch (\Throwable) {
            return null;
        }
    }

    protected function parseLocationNode(\SimpleXMLElement $locationNode): array
    {
        $sectorUid = isset($locationNode->sector)
            ? trim((string) ($locationNode->sector['uid'] ?? '')) ?: null
            : null;
        $sectorName = isset($locationNode->sector)
            ? trim((string) $locationNode->sector) ?: null
            : null;
        $systemUid = isset($locationNode->system)
            ? trim((string) ($locationNode->system['uid'] ?? '')) ?: null
            : null;
        $systemName = isset($locationNode->system)
            ? trim((string) $locationNode->system) ?: null
            : null;
        $galx = null;
        $galy = null;
        $sysx = null;
        $sysy = null;

        if (isset($locationNode->coordinates)) {
            $coords = $locationNode->coordinates;

            if (isset($coords->galaxy)) {
                $galx = $this->toIntOrNull($coords->galaxy['x'] ?? null);
                $galy = $this->toIntOrNull($coords->galaxy['y'] ?? null);
            }

            if (isset($coords->system)) {
                $sysx = $this->toIntOrNull($coords->system['x'] ?? null);
                $sysy = $this->toIntOrNull($coords->system['y'] ?? null);
            }
        }

        return [
            'sector_uid' => $sectorUid,
            'sector_name' => $sectorName,
            'system_uid' => $systemUid,
            'system_name' => $systemName,
            'galx' => $galx,
            'galy' => $galy,
            'sysx' => $sysx,
            'sysy' => $sysy,
        ];
    }

    protected function encodeIdentifierPath(string $identifier): string
    {
        $segments = explode('/', trim($identifier, '/'));
        $segments = array_map(
            static fn (string $segment): string => rawurlencode($segment),
            array_values(array_filter($segments, static fn (string $segment): bool => $segment !== ''))
        );

        return implode('/', $segments);
    }

    protected function extractTypeCollectionNode(\SimpleXMLElement $xml, array $preferredNames): ?\SimpleXMLElement
    {
        foreach ($preferredNames as $name) {
            if (isset($xml->{$name})) {
                return $xml->{$name};
            }
        }

        $rootName = $xml->getName();
        if (in_array($rootName, $preferredNames, true)) {
            return $xml;
        }

        foreach ($xml->children() as $child) {
            if ($child instanceof \SimpleXMLElement && $child->children()->count() > 0) {
                return $child;
            }
        }

        return null;
    }

    protected function extractTypeDetailNode(\SimpleXMLElement $xml, array $preferredNames): ?\SimpleXMLElement
    {
        $rootName = $xml->getName();
        if (in_array($rootName, $preferredNames, true)) {
            return $xml;
        }

        foreach ($preferredNames as $name) {
            if (isset($xml->{$name})) {
                return $xml->{$name};
            }
        }

        foreach ($xml->children() as $child) {
            if ($child instanceof \SimpleXMLElement) {
                return $child;
            }
        }

        return null;
    }

    protected function parseStationTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
        ] : [];
        $weapons = [];
        if (isset($typeNode->weapons) && isset($typeNode->weapons->weapon)) {
            foreach ($typeNode->weapons->weapon as $weapon) {
                $weapons[] = [
                    'uid' => trim((string) ($weapon['uid'] ?? '')) ?: null,
                    'href' => trim((string) ($weapon['href'] ?? '')) ?: null,
                    'name' => trim((string) $weapon) ?: null,
                    'quantity' => $this->toIntOrNull($weapon['quantity'] ?? null),
                    'arc' => trim((string) ($weapon['arc'] ?? '')) ?: null,
                    'arc_from' => $this->toIntOrNull($weapon['arcFrom'] ?? null),
                    'arc_to' => $this->toIntOrNull($weapon['arcTo'] ?? null),
                ];
            }
        }
        $materials = [];
        if (isset($typeNode->materials) && isset($typeNode->materials->material)) {
            foreach ($typeNode->materials->material as $material) {
                $materials[] = [
                    'uid' => trim((string) ($material['uid'] ?? '')) ?: null,
                    'href' => trim((string) ($material['href'] ?? '')) ?: null,
                    'name' => trim((string) $material) ?: null,
                    'quantity' => $this->toIntOrNull($material['quantity'] ?? null),
                ];
            }
        }

        return [
            'uid' => $uid,
            'name' => $name,
            'length' => $this->firstFloatValue($typeNode, ['length']),
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'sensors' => $this->firstIntValue($typeNode, ['sensors']),
            'ecm' => $this->firstIntValue($typeNode, ['ecm']),
            'weight_tonnes' => $this->firstFloatValue($typeNode, ['weight']),
            'volume_m3' => $this->firstFloatValue($typeNode, ['volume']),
            'weight_capacity_tonnes' => $this->firstFloatValue($typeNode, ['weightcapacity']),
            'volume_capacity_m3' => $this->firstFloatValue($typeNode, ['volumecapacity']),
            'max_passengers' => $this->firstIntValue($typeNode, ['maxpassengers']),
            'escape_pods' => $this->firstIntValue($typeNode, ['escapepods']),
            'hull' => $this->firstIntValue($typeNode, ['hull']),
            'shield' => $this->firstIntValue($typeNode, ['shield']),
            'ionic_capacity' => $this->firstIntValue($typeNode, ['ioniccapacity']),
            'medical_rooms' => $this->firstIntValue($typeNode, ['medicalrooms']),
            'has_hangar_bay' => $this->toBoolOrNull($typeNode->hangarbay ?? null),
            'has_docking_bay' => $this->toBoolOrNull($typeNode->dockingbay ?? null),
            'can_recycle' => $this->toBoolOrNull($typeNode->canrecycle ?? null),
            'can_produce' => $this->toBoolOrNull($typeNode->canproduce ?? null),
            'is_asteroid_mining_depot' => $this->toBoolOrNull($typeNode->isasteroidminingdepot ?? null),
            'can_refine_alazhi' => $this->toBoolOrNull($typeNode->canrefinealazhi ?? null),
            'can_interdict' => $this->toBoolOrNull($typeNode->caninterdict ?? null),
            'can_research' => $this->toBoolOrNull($typeNode->canresearch ?? null),
            'price_credits' => isset($typeNode->price) ? $this->firstIntValue($typeNode->price, ['credits']) : null,
            'production_modifier' => isset($typeNode->production) ? $this->firstIntValue($typeNode->production, ['modifier']) : null,
            'recommended_workers' => isset($typeNode->production) ? $this->firstIntValue($typeNode->production, ['recommendedWorkers']) : null,
            'recycling_xp' => isset($typeNode->production) ? $this->firstIntValue($typeNode->production, ['recyclingXP']) : null,
            'generic_slots' => isset($typeNode->production) ? $this->firstIntValue($typeNode->production, ['genericSlots']) : null,
            'weapons' => $weapons,
            'materials' => $materials,
            'images' => $images !== [] ? $images : null,
            'image_url' => $images['large'] ?? $images['small'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function parseShipTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
            'icon' => $this->firstStringValue($typeNode->images, ['icon']),
        ] : [];

        return [
            'uid' => $uid,
            'name' => $name,
            'class_name' => $this->firstStringValue($typeNode, ['class', 'classname', 'class_name']),
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'length' => $this->firstFloatValue($typeNode, ['length']),
            'max_speed' => $this->firstIntValue($typeNode, ['maxspeed', 'speed']),
            'hyperdrive' => $this->firstFloatValue($typeNode, ['hyperdrive']),
            'max_passengers' => $this->firstIntValue($typeNode, ['maxpassengers']),
            'hull' => $this->firstIntValue($typeNode, ['hull']),
            'shield' => $this->firstIntValue($typeNode, ['shield']),
            'price_credits' => isset($typeNode->price) ? $this->firstIntValue($typeNode->price, ['credits']) : null,
            'images' => $images !== [] ? $images : null,
            'image_url' => $images['large'] ?? $images['small'] ?? $images['icon'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function parseFacilityTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
            'icon' => $this->firstStringValue($typeNode->images, ['icon']),
        ] : [];

        return [
            'uid' => $uid,
            'name' => $name,
            'class_name' => $this->firstStringValue($typeNode, ['class', 'classname', 'class_name']),
            'size' => $this->firstStringValue($typeNode, ['size']),
            'length' => $this->firstFloatValue($typeNode, ['length']),
            'width' => $this->firstFloatValue($typeNode, ['width']),
            'height' => $this->firstFloatValue($typeNode, ['height']),
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'price_credits' => isset($typeNode->price) ? $this->firstIntValue($typeNode->price, ['credits']) : null,
            'images' => $images !== [] ? $images : null,
            'image_url' => $images['large'] ?? $images['small'] ?? $images['icon'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function parseItemTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'icon' => $this->firstStringValue($typeNode->images, ['icon']),
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
        ] : [];

        return [
            'uid' => $uid,
            'name' => $name,
            'class_uid' => isset($typeNode->class) ? (trim((string) ($typeNode->class['uid'] ?? '')) ?: null) : null,
            'class_name' => isset($typeNode->class)
                ? (trim((string) ($typeNode->class['value'] ?? $typeNode->class)) ?: null)
                : null,
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'weight_tonnes' => $this->firstFloatValue($typeNode, ['weight']),
            'volume_m3' => $this->firstFloatValue($typeNode, ['volume']),
            'price_credits' => isset($typeNode->price) ? $this->firstIntValue($typeNode->price, ['credits']) : null,
            'images' => $images !== [] ? $images : null,
            'image_url' => $images['large'] ?? $images['small'] ?? $images['icon'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function parseTerrainTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
        ] : [];
        $materialTypes = [];
        if (isset($typeNode->materialtypes) && isset($typeNode->materialtypes->materialtype)) {
            foreach ($typeNode->materialtypes->materialtype as $materialType) {
                $materialTypes[] = [
                    'uid' => trim((string) ($materialType['uid'] ?? '')) ?: null,
                    'href' => trim((string) ($materialType['href'] ?? '')) ?: null,
                    'name' => trim((string) $materialType) ?: null,
                ];
            }
        }

        return [
            'uid' => $uid,
            'name' => $name,
            'code' => $this->firstStringValue($typeNode, ['code']),
            'material_probability_percent' => $this->firstIntValue($typeNode, ['materialprobabilitypercent']),
            'material_types' => $materialTypes,
            'images' => $images !== [] ? $images : null,
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'image_url' => $images['large'] ?? $images['small'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function parseMaterialTypeNode(\SimpleXMLElement $typeNode, ?string $fallbackIdentifier = null): array
    {
        $payload = $this->simpleXmlToArray($typeNode);
        $uid = trim((string) ($typeNode->uid ?? $typeNode['uid'] ?? $fallbackIdentifier ?? '')) ?: null;
        $name = trim((string) ($typeNode->name ?? $typeNode['name'] ?? $typeNode)) ?: null;
        $images = isset($typeNode->images) ? [
            'icon' => $this->firstStringValue($typeNode->images, ['icon']),
            'small' => $this->firstStringValue($typeNode->images, ['small']),
            'large' => $this->firstStringValue($typeNode->images, ['large']),
            'deposit' => $this->firstStringValue($typeNode->images, ['deposit']),
        ] : [];

        return [
            'uid' => $uid,
            'name' => $name,
            'description' => $this->firstStringValue($typeNode, ['description', 'desc']),
            'weight_tonnes' => $this->firstFloatValue($typeNode, ['weight']),
            'volume_m3' => $this->firstFloatValue($typeNode, ['volume']),
            'rarity' => $this->firstIntValue($typeNode, ['rarity']),
            'price_credits' => isset($typeNode->price) ? $this->firstIntValue($typeNode->price, ['credits']) : null,
            'images' => $images !== [] ? $images : null,
            'image_url' => $images['large'] ?? $images['small'] ?? $images['icon'] ?? $images['deposit'] ?? $this->firstStringValue($typeNode, ['image', 'image_url', 'imageurl']),
            'payload' => $payload,
        ];
    }

    protected function firstStringValue(\SimpleXMLElement $node, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($node->{$key})) {
                $value = trim((string) $node->{$key});
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    protected function firstIntValue(\SimpleXMLElement $node, array $keys): ?int
    {
        foreach ($keys as $key) {
            if (isset($node->{$key})) {
                $value = $this->toIntOrNull($node->{$key});
                if ($value !== null) {
                    return $value;
                }
            }
        }

        return null;
    }

    protected function firstFloatValue(\SimpleXMLElement $node, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (isset($node->{$key})) {
                $value = $this->toFloatOrNull($node->{$key});
                if ($value !== null) {
                    return $value;
                }
            }
        }

        return null;
    }

    protected function simpleXmlToArray(\SimpleXMLElement $node): array
    {
        $encoded = json_encode($node, JSON_UNESCAPED_SLASHES);

        if (!is_string($encoded)) {
            return [];
        }

        $decoded = json_decode($encoded, true);

        return is_array($decoded) ? $decoded : [];
    }
}
