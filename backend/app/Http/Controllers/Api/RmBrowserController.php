<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SwcAuthorization;
use App\Models\User;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcRmBrowserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RmBrowserController extends Controller
{
    public function __construct(
        protected SwcRmBrowserService $rmBrowserService,
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'factions'   => ['required', 'array', 'min:1'],
            'factions.*' => ['required', 'string', 'in:1376,1791,1796'],
            'sector_uid' => ['sometimes', 'nullable', 'string', 'max:64'],
            'system_uid' => ['sometimes', 'nullable', 'string', 'max:64'],
            'type_uid'   => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        $serviceAccount = User::where('is_rm_browser_service_account', true)->first();

        if (!$serviceAccount) {
            return response()->json([
                'ok' => false,
                'message' => 'No RM Browser service account has been configured. Ask a sysadmin to designate one.',
            ], 503);
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken(
            $serviceAccount,
            SwcAuthorization::CONTEXT_MEMBER_TOOLS
        );

        if (!$accessToken) {
            return response()->json([
                'ok' => false,
                'message' => 'The RM Browser service account does not have an active SWC connection. Ask a sysadmin to log in with that account.',
            ], 503);
        }

        $filters = [
            'sector_uid' => $validated['sector_uid'] ?? null,
            'system_uid' => $validated['system_uid'] ?? null,
            'type_uid'   => $validated['type_uid'] ?? null,
        ];

        $selectedFactions = $validated['factions'];
        $allEntities = [];
        $errors = [];

        // Fire requests per faction — sequential to avoid rate-limit hammering
        foreach ($selectedFactions as $factionUid) {
            $label = SwcRmBrowserService::FACTION_UIDS[$factionUid] ?? ('Faction ' . $factionUid);

            $result = $this->rmBrowserService->fetchAllMaterials(
                $accessToken,
                $factionUid,
                $label,
                $filters
            );

            if ($result['ok']) {
                $allEntities = array_merge($allEntities, $result['entities']);
            } else {
                $errors[] = $result['error'];
            }
        }

        return response()->json([
            'ok'     => true,
            'total'  => count($allEntities),
            'data'   => $allEntities,
            'errors' => $errors ?: null,
        ]);
    }
}
