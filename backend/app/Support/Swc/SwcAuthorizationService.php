<?php

namespace App\Support\Swc;

use App\Models\SwcAuthorization;
use App\Models\User;
use Carbon\Carbon;

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

        $expiresAt = null;
        if (!empty($tokenData['expires_in']) && is_numeric($tokenData['expires_in'])) {
            $expiresAt = Carbon::now()->addSeconds((int) $tokenData['expires_in']);
        }

        return SwcAuthorization::updateOrCreate(
            ['user_id' => $user->id],
            [
                'swc_character_id' => $user->swc_character_id,
                'granted_scopes' => $scopeString,
                'has_personal_events_access' => in_array('character_events', $grantedScopes, true),
                'has_faction_events_access' => in_array('character_events', $grantedScopes, true),
                'access_token_encrypted' => !empty($tokenData['access_token'])
                    ? encrypt((string) $tokenData['access_token'])
                    : null,
                'refresh_token_encrypted' => !empty($tokenData['refresh_token'])
                    ? encrypt((string) $tokenData['refresh_token'])
                    : null,
                'token_expires_at' => $expiresAt,
                'last_verified_at' => now(),
                'revoked_at' => null,
            ]
        );
    }
}