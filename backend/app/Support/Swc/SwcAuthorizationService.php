<?php

namespace App\Support\Swc;

use App\Models\SwcAuthorization;
use App\Models\User;

class SwcAuthorizationService
{
    public function forUser(User $user): ?SwcAuthorization
    {
        return $user->swcAuthorization;
    }

    public function hasPersonalEventsAccess(User $user): bool
    {
        return (bool) $user->swcAuthorization?->has_personal_events_access;
    }

    public function hasFactionEventsAccess(User $user): bool
    {
        return (bool) $user->swcAuthorization?->has_faction_events_access;
    }

    public function upsertAuthorization(
        User $user,
        array $tokenData,
        array $grantedScopes
    ): SwcAuthorization {
        $scopeString = implode(' ', $grantedScopes);

        return SwcAuthorization::updateOrCreate(
            ['user_id' => $user->id],
            [
                'swc_character_id' => $user->swc_character_id,
                'granted_scopes' => $scopeString,
                'has_personal_events_access' => in_array('character_events', $grantedScopes, true),
                'has_faction_events_access' => in_array('character_events', $grantedScopes, true),
                'access_token_encrypted' => $tokenData['access_token'] ?? null,
                'refresh_token_encrypted' => $tokenData['refresh_token'] ?? null,
                'token_expires_at' => isset($tokenData['expires_at']) ? $tokenData['expires_at'] : null,
                'last_verified_at' => now(),
                'revoked_at' => null,
            ]
        );
    }
}