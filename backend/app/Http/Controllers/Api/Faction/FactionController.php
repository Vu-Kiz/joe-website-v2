<?php

namespace App\Http\Controllers\Api\Faction;

use App\Http\Controllers\Controller;
use App\Support\Factions\FactionPermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FactionController extends Controller
{
    public function __construct(
        protected FactionPermissionService $factionPermissionService
    ) {
    }

    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $factions = $user->factions()->get([
            'factions.id',
            'factions.name',
            'factions.swc_uid',
            'factions.abbreviation',
        ])->map(function ($faction) {
            return [
                'id' => $faction->id,
                'name' => $faction->name,
                'swc_uid' => $faction->swc_uid,
                'abbreviation' => $faction->abbreviation,
                'can_view_payments' => (bool) $faction->pivot?->can_view_payments,
                'can_pay_from_faction' => (bool) $faction->pivot?->can_pay_from_faction,
                'can_mark_payments_paid' => (bool) $faction->pivot?->can_mark_payments_paid,
                'can_manage_jobs' => (bool) $faction->pivot?->can_manage_jobs,
            ];
        })->values();

        return response()->json([
            'ok' => true,
            'data' => $factions,
        ]);
    }

    public function minePayable(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $factions = $this->factionPermissionService
            ->getPayableFactions($user)
            ->map(fn ($faction) => [
                'id' => $faction->id,
                'name' => $faction->name,
                'swc_uid' => $faction->swc_uid,
                'abbreviation' => $faction->abbreviation,
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'data' => $factions,
        ]);
    }
}