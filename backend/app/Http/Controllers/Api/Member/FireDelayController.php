<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcAuthorization;
use App\Models\User;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Universe\FireDelayService;
use App\Support\Universe\FireDelaySettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FireDelayController extends Controller
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService,
        protected FireDelayService $fireDelayService,
    ) {}

    public function fetch(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->is_raid && !$user->is_sysadmin) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $serviceAccount = User::where('is_combat_ops_service_account', true)->first();

        if (!$serviceAccount) {
            return response()->json([
                'ok'      => false,
                'message' => 'No combat ops service account has been configured. Ask a sysadmin to designate one.',
            ], 503);
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken(
            $serviceAccount,
            SwcAuthorization::CONTEXT_COMBAT_OPS
        );

        if (!$accessToken) {
            return response()->json([
                'ok'      => false,
                'message' => 'The combat ops service account does not have an active SWC connection. Ask a sysadmin to log in with that account.',
            ], 503);
        }

        $since      = now()->subHours(2)->unix();
        $factionUid = FireDelaySettings::getFactionUid();

        $result = $this->fireDelayService->fetchFromFactionEvents(
            $accessToken, 'combat', $factionUid, $since
        );

        if (!($result['ok'] ?? false)) {
            return response()->json([
                'ok'      => false,
                'message' => 'Failed to fetch combat events from SWC.',
                'debug'   => $result,
            ], 502);
        }

        $ships = $this->fireDelayService->enrichWithDroidBrainData($result['by_ship']);

        return response()->json([
            'ok'   => true,
            'data' => [
                'ships'              => $ships,
                'fetched_at'         => now()->unix(),
                'fire_delay_seconds' => FireDelayService::FIRE_DELAY_SECONDS,
                'faction_uid'        => $factionUid,
            ],
        ]);
    }

    public function getSettings(): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => FireDelaySettings::toArray()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'faction_uid' => ['required', 'integer', 'min:1'],
        ]);

        FireDelaySettings::setFactionUid((int) $validated['faction_uid']);

        return response()->json(['ok' => true, 'data' => FireDelaySettings::toArray()]);
    }
}
