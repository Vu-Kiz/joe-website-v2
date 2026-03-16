<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Swc\SwcPrivilegeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FactionPrivilegeController extends Controller
{
    public function __construct(
        protected SwcPrivilegeService $swcPrivilegeService
    ) {
    }

    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'privilege_group' => ['required', 'string', 'max:100'],
            'privilege_name' => ['required', 'string', 'max:100'],
            'refresh' => ['nullable', 'boolean'],
        ]);

        $refresh = (bool) ($data['refresh'] ?? true);

        $factions = $user->factions()->get([
            'factions.id',
            'factions.name',
            'factions.swc_uid',
            'factions.abbreviation',
        ]);

        $results = $factions->map(function ($faction) use ($user, $data, $refresh) {
            $check = $this->swcPrivilegeService->checkFactionPrivilege(
                user: $user,
                faction: $faction,
                privilegeGroup: $data['privilege_group'],
                privilegeName: $data['privilege_name'],
                refresh: $refresh
            );

            return [
                'id' => $faction->id,
                'name' => $faction->name,
                'swc_uid' => $faction->swc_uid,
                'abbreviation' => $faction->abbreviation,
                'privilege_group' => $data['privilege_group'],
                'privilege_name' => $data['privilege_name'],
                'check' => $check,
            ];
        })->values();

        return response()->json([
            'ok' => true,
            'data' => $results,
        ]);
    }
}