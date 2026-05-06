<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\SwcFactionPrivilegeCache;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SwcPrivilegeService
{
    protected const CACHE_TTL_MINUTES = 5;

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function checkFactionPrivilege(
        User $user,
        Faction $faction,
        string $privilegeGroup,
        string $privilegeName,
        bool $refresh = true
    ): array {
        $cache = SwcFactionPrivilegeCache::query()
            ->where('user_id', $user->id)
            ->where('faction_id', $faction->id)
            ->where('privilege_group', $privilegeGroup)
            ->where('privilege_name', $privilegeName)
            ->first();

        if ($cache && (!$refresh || $this->isCacheFresh($cache))) {
            return [
                'ok' => true,
                'allowed' => (bool) $cache->is_allowed,
                'source' => 'cache',
                'checked_at' => optional($cache->checked_at)?->toIso8601String(),
                'meta' => $cache->meta,
            ];
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken($user, \App\Models\SwcAuthorization::CONTEXT_PAYMENTS);

        if (!$accessToken) {
            return [
                'ok' => false,
                'allowed' => false,
                'message' => 'No SWC authorization token available.',
            ];
        }

        if (!$this->swcAuthorizationService->hasCharacterPrivilegesAccess($user)) {
            return [
                'ok' => false,
                'allowed' => false,
                'message' => 'SWC character_privileges scope is not connected.',
            ];
        }

        if (!$user->swc_character_id) {
            return [
                'ok' => false,
                'allowed' => false,
                'message' => 'User has no SWC character id.',
            ];
        }

        if (!$faction->swc_uid) {
            return [
                'ok' => false,
                'allowed' => false,
                'message' => 'Faction has no SWC uid.',
            ];
        }

        $characterUid = '1:' . $user->swc_character_id;

        $url = rtrim((string) config('swc.api_base'), '/')
            . '/character/' . urlencode($characterUid)
            . '/privileges/' . urlencode($privilegeGroup)
            . '/' . urlencode($privilegeName) . '/';

        $response = SwcHttp::make($accessToken)->get($url, [
            'faction_id' => (int) $faction->swc_uid,
        ]);

        $json = $response->json() ?? [];

        if (!$response->ok()) {
            Log::warning('SWC faction privilege check failed', [
                'user_id' => $user->id,
                'faction_id' => $faction->id,
                'faction_swc_uid' => $faction->swc_uid,
                'privilege_group' => $privilegeGroup,
                'privilege_name' => $privilegeName,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $this->storeCache(
                user: $user,
                faction: $faction,
                privilegeGroup: $privilegeGroup,
                privilegeName: $privilegeName,
                isAllowed: false,
                meta: [
                    'ok' => false,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]
            );

            return [
                'ok' => false,
                'allowed' => false,
                'message' => 'SWC privilege check failed.',
                'status' => $response->status(),
            ];
        }

        $isAllowed = $this->extractPrivilegeAllowed($json);

        $this->storeCache(
            user: $user,
            faction: $faction,
            privilegeGroup: $privilegeGroup,
            privilegeName: $privilegeName,
            isAllowed: $isAllowed,
            meta: $json
        );

        return [
            'ok' => true,
            'allowed' => $isAllowed,
            'source' => 'swc',
            'checked_at' => now()->toIso8601String(),
            'meta' => $json,
        ];
    }

    protected function storeCache(
        User $user,
        Faction $faction,
        string $privilegeGroup,
        string $privilegeName,
        bool $isAllowed,
        array $meta = []
    ): void {
        SwcFactionPrivilegeCache::updateOrCreate(
            [
                'user_id' => $user->id,
                'faction_id' => $faction->id,
                'privilege_group' => $privilegeGroup,
                'privilege_name' => $privilegeName,
            ],
            [
                'is_allowed' => $isAllowed,
                'checked_at' => now(),
                'meta' => $meta,
            ]
        );
    }

    protected function extractPrivilegeAllowed(array $json): bool
    {
        $candidates = [
            data_get($json, 'swcapi.privilege.haspriv'),
            data_get($json, 'swcapi.privilege.value'),
            data_get($json, 'swcapi.haspriv'),
            data_get($json, 'haspriv'),
            data_get($json, 'allowed'),
            data_get($json, 'swcapi.privilege.allowed'),
        ];

        foreach ($candidates as $candidate) {
            if (is_bool($candidate)) {
                return $candidate;
            }

            if (is_numeric($candidate)) {
                return (bool) $candidate;
            }

            if (is_string($candidate)) {
                $normalized = strtolower(trim($candidate));
                if (in_array($normalized, ['1', 'true', 'yes', 'allowed'], true)) {
                    return true;
                }
                if (in_array($normalized, ['0', 'false', 'no', 'denied'], true)) {
                    return false;
                }
            }
        }

        return false;
    }

    protected function isCacheFresh(SwcFactionPrivilegeCache $cache): bool
    {
        if (!$cache->checked_at instanceof Carbon) {
            return false;
        }

        return $cache->checked_at->gte(now()->subMinutes(self::CACHE_TTL_MINUTES));
    }
}
