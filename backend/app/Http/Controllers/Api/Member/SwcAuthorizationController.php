<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcAuthorization;
use App\Support\Swc\SwcAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SwcAuthorizationController extends Controller
{
    protected const DEFAULT_MEMBER_TOOL_PREFERENCES = [
        'galaxy' => true,
        'payments' => true,
        'fleet_command' => true,
        'market_personal' => false,
        'market_faction' => false,
        'universe' => [
            'map_scope' => 'sector',
            'selected_sector_uid' => null,
            'selected_system_identifier' => null,
            'focus_request' => null,
        ],
    ];

    protected const DEFAULT_PUBLIC_TOOL_PREFERENCES = [
        'payments'    => true,
        'astrogation' => true,
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
        $publicToolsAuth = $user->swcAuthorizations()
            ->where('auth_context', SwcAuthorization::CONTEXT_PUBLIC_TOOLS)
            ->first();
        $publicToolsConnected = $this->swcAuthorizationService->isAuthorizationActive($publicToolsAuth);
        $paymentsConnected = $memberToolsConnected || $this->swcAuthorizationService->isAuthorizationActive($paymentsAuth);
        $eventsConnected = $memberToolsConnected || $this->swcAuthorizationService->isAuthorizationActive($eventsAuth);

        return response()->json([
            'ok' => true,
            'data' => [
                'member_tool_preferences' => $this->normalizeMemberToolPreferences($user->member_tool_preferences),
                'public_tool_preferences' => $this->normalizePublicToolPreferences($user->public_tool_preferences),
                'connected' => $memberToolsConnected || $publicToolsConnected || $paymentsConnected || $eventsConnected,
                'member_tools_connected' => $memberToolsConnected,
                'public_tools_connected' => $publicToolsConnected,
                'payments_connected' => $paymentsConnected,
                'events_connected' => $eventsConnected,
                'has_personal_events_access' => $this->swcAuthorizationService->hasPersonalEventsAccess($user),
                'has_faction_events_access' => false,
                'has_personal_credit_log_access' => $this->swcAuthorizationService->hasPersonalCreditLogAccess($user),
                'has_faction_credit_log_access' => $this->swcAuthorizationService->hasFactionCreditLogAccess($user),
                'has_faction_credits_write_access' => $this->swcAuthorizationService->hasFactionCreditsWriteAccess($user),
                'has_character_privileges_access' => $this->swcAuthorizationService->hasCharacterPrivilegesAccess($user),
                'has_character_skills_access' => $this->swcAuthorizationService->hasCharacterSkillsAccess($user),
                'has_character_credits_write_access' => $this->swcAuthorizationService->hasCharacterCreditsWriteAccess($user),
                'has_personal_inventory_access' => $this->swcAuthorizationService->hasPersonalInventoryAccess($user),
                'has_faction_inventory_access' => $this->swcAuthorizationService->hasFactionInventoryAccess($user),
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
            'member_tool_preferences' => ['nullable', 'array'],
            'member_tool_preferences.galaxy' => ['nullable', 'boolean'],
            'member_tool_preferences.payments' => ['nullable', 'boolean'],
            'member_tool_preferences.fleet_command' => ['nullable', 'boolean'],
            'member_tool_preferences.market_personal' => ['nullable', 'boolean'],
            'member_tool_preferences.market_faction' => ['nullable', 'boolean'],
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
            'public_tool_preferences' => ['nullable', 'array'],
            'public_tool_preferences.payments' => ['nullable', 'boolean'],
            'public_tool_preferences.astrogation' => ['nullable', 'boolean'],
        ]);

        $hasMemberPayload = array_key_exists('member_tool_preferences', $validated);
        $hasPublicPayload = array_key_exists('public_tool_preferences', $validated);

        if (!$hasMemberPayload && !$hasPublicPayload) {
            return response()->json([
                'ok' => false,
                'message' => 'At least one preference group is required.',
            ], 422);
        }

        $currentMemberPreferences = $this->normalizeMemberToolPreferences($user->member_tool_preferences);
        $incomingMemberPreferences = ($hasMemberPayload && is_array($validated['member_tool_preferences'] ?? null))
            ? $validated['member_tool_preferences']
            : [];
        $memberPreferences = $this->normalizeMemberToolPreferences(
            $hasMemberPayload
                ? array_replace_recursive($currentMemberPreferences, $incomingMemberPreferences)
                : $currentMemberPreferences
        );

        $currentPublicPreferences = $this->normalizePublicToolPreferences($user->public_tool_preferences);
        $incomingPublicPreferences = ($hasPublicPayload && is_array($validated['public_tool_preferences'] ?? null))
            ? $validated['public_tool_preferences']
            : [];
        $publicPreferences = $this->normalizePublicToolPreferences(
            $hasPublicPayload
                ? array_replace_recursive($currentPublicPreferences, $incomingPublicPreferences)
                : $currentPublicPreferences
        );

        $user->member_tool_preferences = $memberPreferences;
        $user->public_tool_preferences = $publicPreferences;
        $user->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'member_tool_preferences' => $memberPreferences,
                'public_tool_preferences' => $publicPreferences,
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
            'fleet_command' => array_key_exists('fleet_command', $current)
                ? (bool) $current['fleet_command']
                : self::DEFAULT_MEMBER_TOOL_PREFERENCES['fleet_command'],
            'market_personal' => array_key_exists('market_personal', $current)
                ? (bool) $current['market_personal']
                : self::DEFAULT_MEMBER_TOOL_PREFERENCES['market_personal'],
            'market_faction' => array_key_exists('market_faction', $current)
                ? (bool) $current['market_faction']
                : self::DEFAULT_MEMBER_TOOL_PREFERENCES['market_faction'],
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

        $result = [
            'map_scope' => ($current['map_scope'] ?? null) === 'galaxy' ? 'galaxy' : 'sector',
            'selected_sector_uid' => isset($current['selected_sector_uid']) && $current['selected_sector_uid'] !== ''
                ? (string) $current['selected_sector_uid']
                : null,
            'selected_system_identifier' => isset($current['selected_system_identifier']) && $current['selected_system_identifier'] !== ''
                ? (string) $current['selected_system_identifier']
                : null,
            'focus_request' => $normalizedFocus,
        ];

        // Preserve system_updater cursor — managed by importPersonalEvents, not this endpoint.
        if (is_array($current['system_updater'] ?? null)) {
            $result['system_updater'] = $current['system_updater'];
        }

        return $result;
    }

    protected function normalizePublicToolPreferences(mixed $preferences): array
    {
        $current = is_array($preferences) ? $preferences : [];

        return [
            'payments' => array_key_exists('payments', $current)
                ? (bool) $current['payments']
                : self::DEFAULT_PUBLIC_TOOL_PREFERENCES['payments'],
            'astrogation' => array_key_exists('astrogation', $current)
                ? (bool) $current['astrogation']
                : self::DEFAULT_PUBLIC_TOOL_PREFERENCES['astrogation'],
        ];
    }
}
