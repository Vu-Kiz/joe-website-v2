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

    public function hasPersonalCreditLogAccess(User $user): bool
    {
        return (bool) $user->swcAuthorization?->has_personal_credit_log_access;
    }

    public function hasFactionCreditLogAccess(User $user): bool
    {
        return (bool) $user->swcAuthorization?->has_faction_credit_log_access;
    }

    public function hasCharacterPrivilegesAccess(User $user): bool
    {
        return (bool) $user->swcAuthorization?->has_character_privileges_access;
    }

    public function getAccessToken(User $user): ?string
    {
        $encrypted = $user->swcAuthorization?->access_token_encrypted;

        if (!$encrypted) {
            return null;
        }

        try {
            return decrypt($encrypted);
        } catch (\Throwable) {
            return null;
        }
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

        $hasPersonalCreditLogAccess =
            in_array('character_credits', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);

        $hasFactionCreditLogAccess =
            in_array('faction_credits_read', $grantedScopes, true)
            || in_array('faction_all', $grantedScopes, true);

        return SwcAuthorization::updateOrCreate(
            ['user_id' => $user->id],
            [
                'swc_character_id' => $user->swc_character_id,
                'granted_scopes' => $scopeString,
                'has_personal_credit_log_access' => $hasPersonalCreditLogAccess,
                'has_faction_credit_log_access' => $hasFactionCreditLogAccess,
                'has_character_privileges_access' => in_array('character_privileges', $grantedScopes, true),
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