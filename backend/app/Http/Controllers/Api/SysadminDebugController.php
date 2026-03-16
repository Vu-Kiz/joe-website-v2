<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\PaymentItem;
use App\Models\PaymentTransfer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class SysadminDebugController extends Controller
{
    public function swcAuth(Request $request): JsonResponse
    {
        $targetUserId = (int) $request->query('user_id', 0);

        $user = $targetUserId > 0
            ? User::with(['swcAuthorization', 'factions'])->find($targetUserId)
            : $request->user()?->load(['swcAuthorization', 'factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $user->swcAuthorization;

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                ],
                'authorization' => [
                    'exists' => (bool) $auth,
                    'granted_scopes' => $auth?->granted_scopes,
                    'has_personal_events_access' => (bool) $auth?->has_personal_events_access,
                    'has_faction_events_access' => (bool) $auth?->has_faction_events_access,
                    'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                    'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                    'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                    'has_access_token' => !empty($auth?->access_token_encrypted),
                    'has_refresh_token' => !empty($auth?->refresh_token_encrypted),
                ],
                'factions' => $user->factions->map(function ($faction) {
                    return [
                        'id' => $faction->id,
                        'name' => $faction->name,
                        'swc_uid' => $faction->swc_uid,
                        'pivot' => [
                            'can_view_payments' => (bool) $faction->pivot?->can_view_payments,
                            'can_pay_from_faction' => (bool) $faction->pivot?->can_pay_from_faction,
                            'can_mark_payments_paid' => (bool) $faction->pivot?->can_mark_payments_paid,
                            'can_manage_jobs' => (bool) $faction->pivot?->can_manage_jobs,
                        ],
                    ];
                })->values(),
                'config' => [
                    'authorize_url' => Config::get('swc.authorize_url'),
                    'token_url' => Config::get('swc.token_url'),
                    'api_base' => Config::get('swc.api_base'),
                    'redirect_uri' => Config::get('swc.redirect_uri'),
                    'default_scope' => Config::get('swc.default_scope'),
                    'events_scope' => Config::get('swc.events_scope'),
                    'access_type' => Config::get('swc.access_type'),
                    'events_access_type' => Config::get('swc.events_access_type'),
                ],
            ],
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        $targetUserId = (int) $request->query('user_id', 0);

        $user = $targetUserId > 0
            ? User::with(['factions'])->find($targetUserId)
            : $request->user()?->load(['factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $factionIds = $user->factions()
            ->wherePivot('can_view_payments', true)
            ->pluck('factions.id');

        $pendingItems = PaymentItem::query()
            ->where('status', 'pending')
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get();

        $transfers = PaymentTransfer::query()
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->with('items')
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                ],
                'pending_items' => $pendingItems,
                'transfers' => $transfers,
            ],
        ]);
    }

    public function factions(): JsonResponse
    {
        $factions = Faction::query()
            ->orderBy('name')
            ->get(['id', 'name', 'swc_uid', 'abbreviation']);

        return response()->json([
            'ok' => true,
            'data' => $factions,
        ]);
    }
    public function rawSwc(Request $request): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    $auth = $user->swcAuthorization;

    if (!$auth || empty($auth->access_token_encrypted)) {
        return response()->json(['message' => 'No SWC authorization token found.'], 422);
    }

    $path = trim((string) $request->query('path', ''));
    if ($path === '') {
        return response()->json(['message' => 'path is required'], 422);
    }

    $query = $request->query();
    unset($query['path']);

    $accessToken = decrypt($auth->access_token_encrypted);

    $url = rtrim((string) config('swc.api_base'), '/') . '/' . ltrim($path, '/');

    $response = \App\Support\Swc\SwcHttp::make($accessToken)->get($url, $query);

    return response()->json([
        'ok' => $response->ok(),
        'status' => $response->status(),
        'url' => $url,
        'query' => $query,
        'body' => $response->body(),
        'json' => $response->json(),
    ]);
    public function testFactionPrivilege(Request $request): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    $auth = $user->swcAuthorization;

    if (!$auth || empty($auth->access_token_encrypted)) {
        return response()->json(['message' => 'No SWC authorization token found.'], 422);
    }

    $group = trim((string) $request->query('group', ''));
    $privilege = trim((string) $request->query('privilege', ''));
    $factionId = trim((string) $request->query('faction_id', ''));

    if ($group === '' || $privilege === '' || $factionId === '') {
        return response()->json([
            'message' => 'group, privilege, and faction_id are required',
        ], 422);
    }

    $accessToken = decrypt($auth->access_token_encrypted);
    $characterUid = '1:' . $user->swc_character_id;

    $url = rtrim((string) config('swc.api_base'), '/')
        . '/character/' . urlencode($characterUid)
        . '/privileges/' . urlencode($group)
        . '/' . urlencode($privilege) . '/';

    $response = \App\Support\Swc\SwcHttp::make($accessToken)->get($url, [
        'faction_id' => $factionId,
    ]);

    return response()->json([
        'ok' => $response->ok(),
        'status' => $response->status(),
        'url' => $url,
        'query' => [
            'faction_id' => $factionId,
        ],
        'body' => $response->body(),
        'json' => $response->json(),
    ]);
}
}
}