<?php

namespace App\Support\Swc;

use App\Models\SwcAuthorization;
use App\Models\User;
use Carbon\Carbon;

class SwcAuthorizationService
{
    public function forUser(User $user, string $context = SwcAuthorization::CONTEXT_MEMBER_TOOLS): ?SwcAuthorization
    {
        return $user->swcAuthorizations()
            ->where('auth_context', $context)
            ->first();
    }

    public function isAuthorizationActive(?SwcAuthorization $auth): bool
    {
        if (!$auth || empty($auth->access_token_encrypted) || $auth->revoked_at) {
            return false;
        }

        if ($auth->token_expires_at && $auth->token_expires_at->isPast()) {
            return false;
        }

        return true;
    }

    protected function firstForContexts(User $user, array $contexts): ?SwcAuthorization
    {
        foreach ($contexts as $context) {
            $auth = $this->forUser($user, $context);
            if ($auth) {
                return $auth;
            }
        }

        return null;
    }

    protected function firstActiveForContexts(User $user, array $contexts): ?SwcAuthorization
    {
        foreach ($contexts as $context) {
            $auth = $this->forUser($user, $context);
            if ($this->isAuthorizationActive($auth)) {
                return $auth;
            }
        }

        return null;
    }

    public function hasPersonalCreditLogAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_personal_credit_log_access;
    }

    public function hasPersonalEventsAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_EVENTS,
        ])?->has_personal_events_access;
    }

    public function hasFactionEventsAccess(User $user): bool
    {
        return false;
    }

    public function hasFactionCreditLogAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_faction_credit_log_access;
    }

    public function hasCharacterPrivilegesAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_character_privileges_access;
    }

    public function getAccessToken(User $user, string $context = SwcAuthorization::CONTEXT_MEMBER_TOOLS): ?string
    {
        $auth = match ($context) {
            SwcAuthorization::CONTEXT_EVENTS => $this->firstActiveForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_EVENTS,
            ]),
            SwcAuthorization::CONTEXT_PAYMENTS => $this->firstActiveForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_PAYMENTS,
            ]),
            SwcAuthorization::CONTEXT_MEMBER_TOOLS => $this->isAuthorizationActive($this->forUser($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS))
                ? $this->forUser($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS)
                : null,
            default => $this->isAuthorizationActive($this->forUser($user, $context))
                ? $this->forUser($user, $context)
                : null,
        };

        $encrypted = $auth?->access_token_encrypted;

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
        array $grantedScopes,
        string $context = SwcAuthorization::CONTEXT_PAYMENTS
    ): SwcAuthorization {
        $scopeString = implode(' ', $grantedScopes);

        $expiresAt = null;
        if (!empty($tokenData['expires_in']) && is_numeric($tokenData['expires_in'])) {
            $expiresAt = Carbon::now()->addSeconds((int) $tokenData['expires_in']);
        }

        $hasPersonalEventsAccess =
            in_array('character_events', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);

        $hasPersonalCreditLogAccess =
            in_array('character_credits', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);

        $hasFactionCreditLogAccess =
            in_array('faction_credits_read', $grantedScopes, true)
            || in_array('faction_all', $grantedScopes, true);

        return SwcAuthorization::updateOrCreate(
            [
                'user_id' => $user->id,
                'auth_context' => $context,
            ],
            [
                'swc_character_id' => $user->swc_character_id,
                'auth_context' => $context,
                'granted_scopes' => $scopeString,
                'has_personal_events_access' => $hasPersonalEventsAccess,
                'has_faction_events_access' => false,
                'has_personal_credit_log_access' => $hasPersonalCreditLogAccess,
                'has_faction_credit_log_access' => $hasFactionCreditLogAccess,
                'has_character_privileges_access' =>
                    in_array('character_privileges', $grantedScopes, true)
                    || in_array('character_all', $grantedScopes, true),
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

    public function normalizeScopeValue(mixed $scopeValue): array
    {
        if (is_array($scopeValue)) {
            return array_values(array_unique(array_filter(array_map('trim', $scopeValue))));
        }

        if (is_string($scopeValue) && trim($scopeValue) !== '') {
            return array_values(array_unique(array_filter(preg_split('/\s+/', trim($scopeValue)))));
        }

        return [];
    }

}
