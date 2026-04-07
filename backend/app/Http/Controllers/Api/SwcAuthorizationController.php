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
        'universe' => [
            'map_scope' => 'sector',
            'selected_sector_uid' => null,
            'selected_system_identifier' => null,
            'focus_request' => null,
        ],
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
            'member_tool_preferences.universe' => ['nullable', 'array'],
            'member_tool_preferences.universe.map_scope' => ['nullable', 'in:sector,galaxy'],
            'member_tool_preferences.universe.selected_sector_uid' => ['nullable', 'string', 'max:255'],
            'member_tool_preferences.universe.selected_system_identifier' => ['nullable', 'string', 'max:255'],
            'member_tool_preferences.universe.focus_request' => ['nullable', 'array'],
            'member_tool_preferences.universe.focus_request.kind' => ['nullable', 'in:sector,coords'],
            'member_tool_preferences.universe.focus_request.sectorUid' => ['nullable', 'string', 'max:255'],
            'member_tool_preferences.universe.focus_request.galx' => ['nullable', 'integer'],
            'member_tool_preferences.universe.focus_request.galy' => ['nullable', 'integer'],
            'member_tool_preferences.universe.focus_request.zoom' => ['nullable', 'numeric'],
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
            'universe' => $this->normalizeUniversePreferences($current['universe'] ?? null),
        ];
    }

    protected function normalizeUniversePreferences(mixed $preferences): array
    {
        $current = is_array($preferences) ? $preferences : [];
        $focusRequest = is_array($current['focus_request'] ?? null) ? $current['focus_request'] : null;
        $kind = is_string($focusRequest['kind'] ?? null) ? $focusRequest['kind'] : null;

        $normalizedFocus = null;
        if ($kind === 'sector' && !empty($focusRequest['sectorUid'])) {
            $normalizedFocus = [
                'kind' => 'sector',
                'sectorUid' => (string) $focusRequest['sectorUid'],
                'zoom' => isset($focusRequest['zoom']) ? (float) $focusRequest['zoom'] : null,
            ];
        } elseif (
            $kind === 'coords' &&
            isset($focusRequest['galx'], $focusRequest['galy']) &&
            is_numeric($focusRequest['galx']) &&
            is_numeric($focusRequest['galy'])
        ) {
            $normalizedFocus = [
                'kind' => 'coords',
                'galx' => (int) $focusRequest['galx'],
                'galy' => (int) $focusRequest['galy'],
                'zoom' => isset($focusRequest['zoom']) ? (float) $focusRequest['zoom'] : null,
            ];
        }

        return [
            'map_scope' => ($current['map_scope'] ?? null) === 'galaxy' ? 'galaxy' : 'sector',
            'selected_sector_uid' => isset($current['selected_sector_uid']) && $current['selected_sector_uid'] !== ''
                ? (string) $current['selected_sector_uid']
                : null,
            'selected_system_identifier' => isset($current['selected_system_identifier']) && $current['selected_system_identifier'] !== ''
                ? (string) $current['selected_system_identifier']
                : null,
            'focus_request' => $normalizedFocus,
        ];
    }
}
