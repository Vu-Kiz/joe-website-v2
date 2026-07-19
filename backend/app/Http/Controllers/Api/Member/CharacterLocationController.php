<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterLocationController extends Controller
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService,
        protected SwcInventoryService $swcInventoryService,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if (!$user->swc_character_id) {
            return response()->json(['ok' => false, 'message' => 'No SWC character linked to this account.'], 404);
        }

        $accessToken = $this->swcAuthorizationService->getCharacterLocationAccessToken($user);

        if (!$accessToken) {
            return response()->json([
                'ok' => false,
                'message' => 'Character location access is not granted. Enable the Location tool on your About Me page and re-link SWC.',
            ], 403);
        }

        $result = $this->swcInventoryService->getEntityLocation(
            $accessToken,
            'character',
            '1:' . $user->swc_character_id
        );

        if (!$result['ok']) {
            return response()->json([
                'ok' => false,
                'message' => $result['status'] === 404
                    ? 'Location data unavailable for your character right now.'
                    : 'Failed to fetch character location.',
            ], $result['status'] >= 400 ? $result['status'] : 502);
        }

        $location = $result['json']['swcapi']['location'] ?? $result['json']['location'] ?? $result['json'] ?? [];

        return response()->json([
            'ok' => true,
            'data' => $this->parseLocation($location),
        ]);
    }

    protected function parseLocation(array $loc): array
    {
        $sector     = is_string($loc['sector']['value'] ?? null) ? $loc['sector']['value'] : null;
        $systemName = is_string($loc['system']['value'] ?? null) ? $loc['system']['value'] : null;
        $systemType = $loc['system']['attributes']['type'] ?? null;

        $containerName = is_string($loc['container']['value'] ?? null) ? $loc['container']['value'] : null;
        $containerType = $loc['container']['attributes']['type'] ?? null;
        $containerUid  = $loc['container']['attributes']['uid'] ?? null;
        $docked = $containerType && !in_array(strtolower((string) $containerType), ['system', 'deep space', 'deepspace'], true);

        $galCoords = $loc['coordinates']['galaxy']['attributes'] ?? null;
        $sysCoords = $loc['coordinates']['system']['attributes'] ?? null;

        return [
            'sector'      => $sector,
            'system'      => $systemName,
            'system_type' => $systemType,
            'docked'      => $docked,
            'container'   => $docked ? ['name' => $containerName, 'uid' => $containerUid, 'type' => $containerType] : null,
            'galx'        => $galCoords ? (int) $galCoords['x'] : null,
            'galy'        => $galCoords ? (int) $galCoords['y'] : null,
            'sysx'        => $sysCoords ? (int) $sysCoords['x'] : null,
            'sysy'        => $sysCoords ? (int) $sysCoords['y'] : null,
        ];
    }
}
