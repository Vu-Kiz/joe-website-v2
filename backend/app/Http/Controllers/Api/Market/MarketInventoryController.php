<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Support\Swc\SwcInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class MarketInventoryController extends Controller
{
    public function __construct(
        protected SwcInventoryService $swcInventoryService
    ) {
    }

    public function personalInventory(Request $request): JsonResponse
    {
        $user = $request->user();
        $entityType = trim((string) $request->query('entity_type', 'ship'));

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);

        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token. Please sync Market (Personal Inventory) access first.'], 422);
        }

        $ownerUid = '1:' . $user->swc_character_id;

        $result = $this->swcInventoryService->getAllInventory($token, $ownerUid, $entityType, tag: 'For Sale');

        return response()->json([
            'ok' => $result['ok'],
            'status' => $result['status'],
            'entity_type' => $entityType,
            'data' => $result['json'],
        ], 200);
    }

    public function factionInventory(Request $request): JsonResponse
    {
        $user = $request->user();
        $entityType = trim((string) $request->query('entity_type', 'ship'));
        $factionId = (int) $request->query('faction_id', 0);

        if ($factionId <= 0) {
            return response()->json(['ok' => false, 'message' => 'faction_id is required.'], 422);
        }

        $faction = Faction::find($factionId);

        if (!$faction) {
            return response()->json(['ok' => false, 'message' => 'Faction not found.'], 404);
        }

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);

        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token. Please sync Market (Faction Store) access first.'], 422);
        }

        $ownerUid = '20:' . $faction->swc_uid;

        $result = $this->swcInventoryService->getAllInventory($token, $ownerUid, $entityType, tag: 'for sale');

        return response()->json([
            'ok' => $result['ok'],
            'status' => $result['status'],
            'entity_type' => $entityType,
            'faction' => ['id' => $faction->id, 'name' => $faction->name, 'swc_uid' => $faction->swc_uid],
            'data' => $result['json'],
        ], 200);
    }

    public function entityDetail(Request $request): JsonResponse
    {
        $user = $request->user();
        $entityType = trim((string) $request->query('entity_type', ''));
        $entityUid  = trim((string) $request->query('entity_uid', ''));

        if ($entityType === '' || $entityUid === '') {
            return response()->json(['ok' => false, 'message' => 'entity_type and entity_uid are required.'], 422);
        }

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);

        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token.'], 422);
        }

        $result = $this->swcInventoryService->getEntity($token, $entityType, $entityUid);

        if (!$result['ok']) {
            return response()->json([
                'ok' => false,
                'message' => 'SWC returned ' . $result['status'],
                'swc_status' => $result['status'],
            ], 422);
        }

        $raw = $result['json'];
        $val = $raw['swcapi']['entity']['value'] ?? $raw['swcapi']['entity'] ?? null;

        $parsed = $this->parseEntityDetail($entityType, $val);

        return response()->json([
            'ok' => true,
            'entity_type' => $entityType,
            'data' => $parsed,
            'raw' => $val,
        ]);
    }

    public function snapshotEntity(string $token, string $entityType, string $entityUid): array
    {
        $result = $this->swcInventoryService->getEntity($token, $entityType, $entityUid);

        if (!$result['ok']) {
            return [];
        }

        $raw = $result['json'];
        $val = $raw['swcapi']['entity']['value'] ?? $raw['swcapi']['entity'] ?? null;

        return $this->parseEntityDetail($entityType, $val);
    }

    protected function parseEntityDetail(string $entityType, ?array $val): array
    {
        if (!$val) {
            return [];
        }

        // Images — use SWC-provided URLs directly
        $images   = $val['images'] ?? [];
        $imageUrl = !empty($images['small']) ? $images['small']
                  : (!empty($images['large']) ? $images['large'] : null);

        // Entity type (model)
        $typeUid  = $val['type']['attributes']['uid'] ?? null;
        $typeName = is_string($val['type']['value'] ?? null) ? $val['type']['value'] : null;

        // Hull / shield / ionic — each has value + attributes.max
        $hull     = isset($val['hull']['value'])               ? (int) $val['hull']['value']               : null;
        $maxHull  = isset($val['hull']['attributes']['max'])   ? (int) $val['hull']['attributes']['max']   : null;
        $shield   = isset($val['shield']['value'])             ? (int) $val['shield']['value']             : null;
        $maxShield = isset($val['shield']['attributes']['max']) ? (int) $val['shield']['attributes']['max'] : null;
        $ionic    = isset($val['ionic']['value'])              ? (int) $val['ionic']['value']              : null;
        $maxIonic = isset($val['ionic']['attributes']['max'])  ? (int) $val['ionic']['attributes']['max']  : null;

        // Location
        $loc = $val['location'] ?? [];

        $sector     = is_string($loc['sector']['value'] ?? null)    ? $loc['sector']['value']    : null;
        $systemName = is_string($loc['system']['value'] ?? null)    ? $loc['system']['value']    : null;
        $systemType = $loc['system']['attributes']['type'] ?? null;

        // Container = what it's physically inside (ship/station vs the system itself)
        $containerName = is_string($loc['container']['value'] ?? null) ? $loc['container']['value'] : null;
        $containerType = $loc['container']['attributes']['type'] ?? null;
        $containerUid  = $loc['container']['attributes']['uid']  ?? null;
        $docked = $containerType && !in_array(strtolower((string) $containerType), ['system', 'deep space', 'deepspace'], true);

        $galCoords = $loc['coordinates']['galaxy']['attributes'] ?? null;
        $sysCoords = $loc['coordinates']['system']['attributes'] ?? null;

        // Owner
        $ownerName = is_string($val['owner']['value'] ?? null) ? $val['owner']['value'] : null;
        $ownerUid  = $val['owner']['attributes']['uid'] ?? null;

        $quantity = $this->extractQuantity($val);

        // Cargo
        $cargo = null;
        if (!empty($val['cargo'])) {
            $cargo = [
                'weight_total'     => $val['cargo']['weightcapacity']['total']     ?? null,
                'weight_remaining' => $val['cargo']['weightcapacity']['remaining'] ?? null,
                'volume_total'     => $val['cargo']['volumecapacity']['total']     ?? null,
                'volume_remaining' => $val['cargo']['volumecapacity']['remaining'] ?? null,
            ];
        }

        return [
            'uid'        => $val['uid'] ?? null,
            'name'       => $val['name'] ?? null,
            'type_uid'   => $typeUid,
            'type_name'  => $typeName,
            'image_url'  => $imageUrl,
            'quantity'   => $quantity,
            'wrecked'    => ($val['wrecked'] ?? 'no') === 'yes',
            'hull'       => $hull,
            'max_hull'   => $maxHull,
            'shield'     => $shield,
            'max_shield' => $maxShield,
            'ionic'      => $ionic,
            'max_ionic'  => $maxIonic,
            'location'   => [
                'sector'       => $sector,
                'system'       => $systemName,
                'system_type'  => $systemType,
                'docked'       => $docked,
                'container'    => $docked ? ['name' => $containerName, 'uid' => $containerUid, 'type' => $containerType] : null,
                'galx'         => $galCoords ? (int) $galCoords['x'] : null,
                'galy'         => $galCoords ? (int) $galCoords['y'] : null,
                'sysx'         => $sysCoords ? (int) $sysCoords['x'] : null,
                'sysy'         => $sysCoords ? (int) $sysCoords['y'] : null,
            ],
            'owner' => $ownerName ? ['uid' => $ownerUid, 'name' => $ownerName] : null,
            'cargo' => $cargo,
        ];
    }

    private function extractQuantity(array $val): ?int
    {
        $candidates = [
            $val['quantity']['value'] ?? null,
            $val['quantity'] ?? null,
            $val['attributes']['quantity'] ?? null,
            $val['amount']['value'] ?? null,
            $val['amount'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate)) {
                $candidate = $candidate['value'] ?? null;
            }

            if (is_numeric($candidate)) {
                return (int) $candidate;
            }
        }

        return null;
    }
}
