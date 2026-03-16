<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SwcAuthorizationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $auth = $user->swcAuthorization;

        return response()->json([
            'ok' => true,
            'data' => [
                'connected' => (bool) $auth,
                'has_personal_events_access' => (bool) $auth?->has_personal_events_access,
                'has_faction_events_access' => (bool) $auth?->has_faction_events_access,
                'has_character_privileges_access' => (bool) $auth?->has_character_privileges_access,
                'granted_scopes' => $auth?->granted_scopes,
                'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
            ],
        ]);
    }
}