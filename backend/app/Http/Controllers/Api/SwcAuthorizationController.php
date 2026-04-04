<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SwcAuthorization;
use App\Support\Swc\SwcAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SwcAuthorizationController extends Controller
{
    protected const DEFAULT_MEMBER_TOOL_PREFERENCES = [
        'galaxy' => true,
        'payments' => true,
    ];

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $memberToolsAuth = $user->swcAuthorizations()
            ->where('auth_context', SwcAuthorization::CONTEXT_MEMBER_TOOLS)
            ->first();
        $paymentsAuth = $user->swcAuthorizations()
            ->where('auth_context', SwcAuthorization::CONTEXT_PAYMENTS)
            ->first();
        $eventsAuth = $user->swcAuthorizations()
            ->where('auth_context', SwcAuthorization::CONTEXT_EVENTS)
            ->first();

        $memberToolsConnected = $this->swcAuthorizationService->isAuthorizationActive($memberToolsAuth);
        $paymentsConnected = $memberToolsConnected || $this->swcAuthorizationService->isAuthorizationActive($paymentsAuth);
        $eventsConnected = $memberToolsConnected || $this->swcAuthorizationService->isAuthorizationActive($eventsAuth);

        return response()->json([
            'ok' => true,
            'data' => [
                'member_tool_preferences' => $this->normalizeMemberToolPreferences($user->member_tool_preferences),
                'connected' => $memberToolsConnected || $paymentsConnected || $eventsConnected,
                'member_tools_connected' => $memberToolsConnected,
                'payments_connected' => $paymentsConnected,
                'events_connected' => $eventsConnected,
                'has_personal_events_access' => $this->swcAuthorizationService->hasPersonalEventsAccess($user),
                'has_faction_events_access' => false,
                'has_personal_credit_log_access' => $this->swcAuthorizationService->hasPersonalCreditLogAccess($user),
                'has_faction_credit_log_access' => $this->swcAuthorizationService->hasFactionCreditLogAccess($user),
                'has_character_privileges_access' => $this->swcAuthorizationService->hasCharacterPrivilegesAccess($user),
                'granted_scopes' => $memberToolsAuth?->granted_scopes ?? $paymentsAuth?->granted_scopes,
                'token_expires_at' => $memberToolsAuth?->token_expires_at?->toIso8601String() ?? $paymentsAuth?->token_expires_at?->toIso8601String(),
                'last_verified_at' => $memberToolsAuth?->last_verified_at?->toIso8601String() ?? $paymentsAuth?->last_verified_at?->toIso8601String(),
                'revoked_at' => $memberToolsAuth?->revoked_at?->toIso8601String() ?? $paymentsAuth?->revoked_at?->toIso8601String(),
                'events_granted_scopes' => $memberToolsAuth?->granted_scopes ?? $eventsAuth?->granted_scopes,
                'events_token_expires_at' => $memberToolsAuth?->token_expires_at?->toIso8601String() ?? $eventsAuth?->token_expires_at?->toIso8601String(),
                'events_last_verified_at' => $memberToolsAuth?->last_verified_at?->toIso8601String() ?? $eventsAuth?->last_verified_at?->toIso8601String(),
                'events_revoked_at' => $memberToolsAuth?->revoked_at?->toIso8601String() ?? $eventsAuth?->revoked_at?->toIso8601String(),
            ],
        ]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'member_tool_preferences' => ['required', 'array'],
            'member_tool_preferences.galaxy' => ['required', 'boolean'],
            'member_tool_preferences.payments' => ['required', 'boolean'],
        ]);

        $preferences = $this->normalizeMemberToolPreferences($validated['member_tool_preferences'] ?? []);
        $user->member_tool_preferences = $preferences;
        $user->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'member_tool_preferences' => $preferences,
            ],
        ]);
    }

    protected function normalizeMemberToolPreferences(mixed $preferences): array
    {
        $current = is_array($preferences) ? $preferences : [];

        return [
            'galaxy' => array_key_exists('galaxy', $current)
                ? (bool) $current['galaxy']
                : self::DEFAULT_MEMBER_TOOL_PREFERENCES['galaxy'],
            'payments' => array_key_exists('payments', $current)
                ? (bool) $current['payments']
                : self::DEFAULT_MEMBER_TOOL_PREFERENCES['payments'],
        ];
    }
}
