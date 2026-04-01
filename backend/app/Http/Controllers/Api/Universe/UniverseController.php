<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SwcFacilityType;
use App\Models\SwcCreatureType;
use App\Models\SwcDroidType;
use App\Models\HyperPlan;
use App\Models\SwcHyperlane;
use App\Models\SwcItemType;
use App\Models\SwcMaterialType;
use App\Models\SwcNpcType;
use App\Models\SwcPlanet;
use App\Models\SwcPlanetType;
use App\Models\SwcRace;
use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use App\Models\SwcSectorSearchRecord;
use App\Models\SwcShipType;
use App\Models\SwcStation;
use App\Models\SwcStationType;
use App\Models\SwcTerrainType;
use App\Models\SwcSystem;
use App\Models\SwcVehicleType;
use App\Models\SwcWeaponType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class UniverseController extends Controller
{
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
        $requestedBounds = $this->resolveRequestedBounds(request());

        $systems = SwcSystem::query()
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $systems,
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

        $systems = SwcSystem::query()
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
            ->filter(fn (SwcSystem $system) => is_string($system->uid) && trim($system->uid) !== '')
            ->keyBy(fn (SwcSystem $system) => trim((string) $system->uid));
        $systemsByIdentifier = $systems
            ->filter(fn (SwcSystem $system) => is_string($system->identifier) && trim($system->identifier) !== '')
            ->keyBy(fn (SwcSystem $system) => trim((string) $system->identifier));
        $systemsByCoords = $systems->keyBy(fn (SwcSystem $system) => $this->systemCoordKey($system->galx, $system->galy));
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
            SwcHyperlane::query()->orderBy('name')->get([
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
        $routeSignatures = [];
        $visitedSystems = 0;
        $exploredStates = 0;
        $maxRoutes = 3;
        $maxExploredStates = 15000;

        $fastestRoutePayload = $this->buildPlannerRoutePayload(
            $fromEndpoint,
            $toEndpoint,
            $fastestHopEdges,
            $systemsById,
            $pilotingSkill,
            $hyperspeed,
            $visitedSystems
        );
        $fastestRouteSignature = $this->buildPlannerRouteSignature($fastestHopEdges);
        $routeOptions[] = $fastestRoutePayload;
        $routeSignatures[$fastestRouteSignature] = true;
        $stateQueue = new \SplPriorityQueue();
        $stateQueue->setExtractFlags(\SplPriorityQueue::EXTR_DATA);
        $stateQueue->insert([
            'node' => $startNode,
            'seconds' => 0,
            'edges' => [],
            'visited' => [$startNode => true],
        ], 0);

        while (!$stateQueue->isEmpty() && $exploredStates < $maxExploredStates) {
            $state = $stateQueue->extract();
            $systemId = (string) ($state['node'] ?? '');
            $elapsedSeconds = (int) ($state['seconds'] ?? 0);
            $currentEdges = is_array($state['edges'] ?? null) ? $state['edges'] : [];
            $visitedNodes = is_array($state['visited'] ?? null) ? $state['visited'] : [];

            $exploredStates++;
            $visitedSystems++;

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

                if ($destinationId !== $endNode && isset($visitedNodes[$destinationId])) {
                    continue;
                }

                $candidateSeconds = $elapsedSeconds + (int) ($edge['lane_seconds'] ?? 0);
                if ($candidateSeconds >= $directTripSeconds) {
                    continue;
                }

                $destinationEndpoint = $edge['to_endpoint']
                    ?? $this->buildPlannerSystemEndpoint($systemsById->get($edge['destination_system_id']));

                if (
                    $destinationId !== $endNode
                    && $destinationEndpoint
                    && isset($destinationEndpoint['galx'], $destinationEndpoint['galy'])
                ) {
                    $remainingDirectSeconds = $this->calculatePlannerDirectTravelSeconds(
                        $this->calculatePlannerJourneyLength(
                            $destinationEndpoint['galx'],
                            $destinationEndpoint['galy'],
                            $toEndpoint['galx'],
                            $toEndpoint['galy']
                        ),
                        $pilotingSkill,
                        $hyperspeed
                    );

                    if (($candidateSeconds + $remainingDirectSeconds) >= $directTripSeconds) {
                        continue;
                    }
                }

                $nextEdges = [...$currentEdges, $edge];

                if ($destinationId === $endNode) {
                    if (!$this->plannerRouteUsesStoredHyperlane($nextEdges)) {
                        continue;
                    }

                    $routePayload = $this->buildPlannerRoutePayload(
                        $fromEndpoint,
                        $toEndpoint,
                        $nextEdges,
                        $systemsById,
                        $pilotingSkill,
                        $hyperspeed,
                        $visitedSystems
                    );

                    $routeSignature = $this->buildPlannerRouteSignature($nextEdges);
                    if (isset($routeSignatures[$routeSignature])) {
                        continue;
                    }

                    $routeSignatures[$routeSignature] = true;
                    $routeOptions[] = $routePayload;

                    usort($routeOptions, fn (array $left, array $right) => ($left['summary']['total_seconds'] ?? PHP_INT_MAX) <=> ($right['summary']['total_seconds'] ?? PHP_INT_MAX));
                    if (count($routeOptions) > $maxRoutes) {
                        $routeOptions = array_slice($routeOptions, 0, $maxRoutes);
                    }
                    continue;
                }

                $nextVisited = $visitedNodes;
                $nextVisited[$destinationId] = true;

                $nextState = [
                    'node' => $destinationId,
                    'seconds' => $candidateSeconds,
                    'edges' => $nextEdges,
                    'visited' => $nextVisited,
                ];

                $stateQueue->insert($nextState, -$candidateSeconds);
            }
        }

        usort($routeOptions, fn (array $left, array $right) => ($left['summary']['total_seconds'] ?? PHP_INT_MAX) <=> ($right['summary']['total_seconds'] ?? PHP_INT_MAX));
        $routeOptions = array_values(array_map(
            fn (array $route, int $index) => [
                ...$route,
                'route_index' => $index,
                'route_label' => sprintf('Route %d', $index + 1),
            ],
            $routeOptions,
            array_keys($routeOptions)
        ));
        $fastestRoute = $routeOptions[0];

        return response()->json([
            'ok' => true,
            'data' => [
                ...$fastestRoute,
                'routes' => $routeOptions,
            ],
        ]);
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
        SwcSystem $sourceSystem,
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
        $canViewAsteroidIntel = $this->canViewAsteroidIntel($request);
        $scanWindow = $this->resolveScanWindow($request);
        $requestedBounds = $this->resolveRequestedBounds($request);

        if (!$canViewAsteroidIntel && !$scanWindow) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $now = Carbon::now();
        $records = [];

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

            $records[] = [
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
                'is_rescan_due' => $record->rescan_due_at
                    ? Carbon::parse($record->rescan_due_at)->lte($now)
                    : false,
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

        return response()->json([
            'ok' => true,
            'data' => $records,
        ]);
    }

    protected function serializePlannerSystem(?SwcSystem $system): ?array
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

    protected function buildPlannerSystemEndpoint(?SwcSystem $system): ?array
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

        $annotationsQuery = SwcSectorCellAnnotation::query();
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
            ]);

        return response()->json([
            'ok' => true,
            'data' => $types,
        ]);
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
        $types = SwcWeaponType::query()
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

        return response()->json([
            'ok' => true,
            'data' => $type,
        ]);
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
