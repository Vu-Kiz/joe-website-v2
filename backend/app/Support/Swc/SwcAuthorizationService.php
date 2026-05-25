<?php

namespace App\Support\Swc;

use App\Models\Swc\SwcAuthorization;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

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
        if (!$auth || $auth->revoked_at) {
            return false;
        }

        $hasAccessToken = !empty($auth->access_token_encrypted);
        $hasRefreshToken = !empty($auth->refresh_token_encrypted);

        if (!$hasAccessToken && !$hasRefreshToken) {
            return false;
        }

        if ($hasAccessToken && (!$auth->token_expires_at || !$auth->token_expires_at->isPast())) {
            return true;
        }

        // Treat refresh-capable authorizations as active for offline access.
        if ($hasRefreshToken) {
            return true;
        }

        return false;
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
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_personal_credit_log_access;
    }

    public function hasPersonalEventsAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
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
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_faction_credit_log_access;
    }

    public function hasCharacterPrivilegesAccess(User $user): bool
    {
        return (bool) $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ])?->has_character_privileges_access;
    }

    public function hasCharacterSkillsAccess(User $user): bool
    {
        $auth = $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ]);

        if (!$auth) {
            return false;
        }

        $grantedScopes = $this->normalizeScopeValue($auth->granted_scopes);

        return
            in_array('character_skills', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);
    }

    public function hasCharacterCreditsWriteAccess(User $user): bool
    {
        $auth = $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ]);

        if (!$auth) {
            return false;
        }

        $grantedScopes = $this->normalizeScopeValue($auth->granted_scopes);

        return
            in_array('character_credits_write', $grantedScopes, true)
            || in_array('character_credits', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);
    }

    public function hasFactionCreditsWriteAccess(User $user): bool
    {
        $auth = $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
        ]);

        if (!$auth) {
            return false;
        }

        $grantedScopes = $this->normalizeScopeValue($auth->granted_scopes);

        return
            in_array('faction_credits_write', $grantedScopes, true)
            || in_array('faction_all', $grantedScopes, true);
    }

    public function hasPersonalInventoryAccess(User $user): bool
    {
        $auth = $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_MARKET_FACTION,
        ]);

        if (!$auth) {
            return false;
        }

        $grantedScopes = $this->normalizeScopeValue($auth->granted_scopes);

        return
            in_array('personal_inv_ships_all', $grantedScopes, true)
            || in_array('personal_inv_overview', $grantedScopes, true)
            || in_array('character_all', $grantedScopes, true);
    }

    public function hasFactionInventoryAccess(User $user): bool
    {
        $auth = $this->firstActiveForContexts($user, [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            SwcAuthorization::CONTEXT_MARKET_FACTION,
        ]);

        if (!$auth) {
            return false;
        }

        $grantedScopes = $this->normalizeScopeValue($auth->granted_scopes);

        return
            in_array('faction_inv_ships_all', $grantedScopes, true)
            || in_array('faction_inv_overview', $grantedScopes, true)
            || in_array('faction_all', $grantedScopes, true);
    }

    public function getAccessToken(User $user, string $context = SwcAuthorization::CONTEXT_MEMBER_TOOLS): ?string
    {
        $auth = match ($context) {
            SwcAuthorization::CONTEXT_EVENTS => $this->firstForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_EVENTS,
            ]),
            SwcAuthorization::CONTEXT_PAYMENTS => $this->firstForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
                SwcAuthorization::CONTEXT_PAYMENTS,
            ]),
            SwcAuthorization::CONTEXT_MEMBER_TOOLS => $this->forUser($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS),
            default => $this->forUser($user, $context),
        };

        if (!$this->isAuthorizationActive($auth)) {
            return null;
        }

        if ($auth && $this->shouldRefreshToken($auth)) {
            $refreshed = $this->refreshAccessToken($auth);
            $auth = $auth->fresh();

            if ((!$refreshed || !$auth) && (!$auth || $this->shouldRefreshToken($auth))) {
                return null;
            }
        }

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
        $existing = SwcAuthorization::query()
            ->where('user_id', $user->id)
            ->where('auth_context', $context)
            ->first();

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
            || in_array('character_credits_write', $grantedScopes, true)
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
                    : $existing?->access_token_encrypted,
                'refresh_token_encrypted' => !empty($tokenData['refresh_token'])
                    ? encrypt((string) $tokenData['refresh_token'])
                    : $existing?->refresh_token_encrypted,
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

    protected function shouldRefreshToken(SwcAuthorization $auth): bool
    {
        if (empty($auth->refresh_token_encrypted)) {
            return false;
        }

        if (empty($auth->access_token_encrypted)) {
            return true;
        }

        if (!$auth->token_expires_at) {
            return false;
        }

        return $auth->token_expires_at->lte(now()->addSeconds(60));
    }

    protected function refreshAccessToken(SwcAuthorization $auth): bool
    {
        if (empty($auth->refresh_token_encrypted)) {
            return false;
        }

        try {
            $refreshToken = decrypt((string) $auth->refresh_token_encrypted);
        } catch (\Throwable) {
            return false;
        }

        if (trim((string) $refreshToken) === '') {
            return false;
        }

        $clientId = (string) Config::get('swc.client_id', '');
        $clientSecret = (string) Config::get('swc.client_secret', '');
        $tokenUrl = rtrim((string) Config::get('swc.token_url', ''), '/');

        if ($clientId === '' || $clientSecret === '' || $tokenUrl === '') {
            return false;
        }

        $response = SwcHttp::make()
            ->asForm()
            ->post($tokenUrl . '/', [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ]);

        if (!$response->ok()) {
            $status = $response->status();
            $body = $response->body();

            Log::warning('SWC refresh token exchange failed', [
                'auth_id' => $auth->id,
                'user_id' => $auth->user_id,
                'auth_context' => $auth->auth_context,
                'status' => $status,
                'body' => $body,
            ]);

            if ($status === 400 || $status === 401) {
                $auth->revoked_at = now();
                $auth->save();
            }

            return false;
        }

        $tokenData = $response->json() ?? [];
        $newAccessToken = trim((string) ($tokenData['access_token'] ?? ''));

        if ($newAccessToken === '') {
            return false;
        }

        $expiresAt = null;
        if (!empty($tokenData['expires_in']) && is_numeric($tokenData['expires_in'])) {
            $expiresAt = Carbon::now()->addSeconds((int) $tokenData['expires_in']);
        }

        $auth->access_token_encrypted = encrypt($newAccessToken);
        if (!empty($tokenData['refresh_token'])) {
            $auth->refresh_token_encrypted = encrypt((string) $tokenData['refresh_token']);
        }
        $auth->token_expires_at = $expiresAt;
        $auth->last_verified_at = now();
        $auth->revoked_at = null;
        $auth->save();

        return true;
    }

    public function forceRefreshForUser(User $user, string $context = SwcAuthorization::CONTEXT_MEMBER_TOOLS): array
    {
        $auth = match ($context) {
            SwcAuthorization::CONTEXT_EVENTS => $this->firstForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_EVENTS,
            ]),
            SwcAuthorization::CONTEXT_PAYMENTS => $this->firstForContexts($user, [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_PAYMENTS,
            ]),
            SwcAuthorization::CONTEXT_MEMBER_TOOLS => $this->forUser($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS),
            default => $this->forUser($user, $context),
        };

        if (!$auth) {
            return [
                'ok' => false,
                'message' => 'No authorization found for context.',
                'auth_context' => $context,
            ];
        }

        $before = [
            'authorization_id' => $auth->id,
            'auth_context' => $auth->auth_context,
            'has_access_token' => !empty($auth->access_token_encrypted),
            'has_refresh_token' => !empty($auth->refresh_token_encrypted),
            'token_expires_at' => $auth->token_expires_at?->toIso8601String(),
            'revoked_at' => $auth->revoked_at?->toIso8601String(),
            'updated_at' => $auth->updated_at?->toIso8601String(),
        ];

        $ok = $this->refreshAccessToken($auth);
        $fresh = $auth->fresh();

        return [
            'ok' => $ok && $fresh instanceof SwcAuthorization,
            'message' => $ok ? 'Refresh attempted successfully.' : 'Refresh attempt failed.',
            'requested_context' => $context,
            'resolved_context' => $auth->auth_context,
            'before' => $before,
            'after' => $fresh ? [
                'authorization_id' => $fresh->id,
                'auth_context' => $fresh->auth_context,
                'has_access_token' => !empty($fresh->access_token_encrypted),
                'has_refresh_token' => !empty($fresh->refresh_token_encrypted),
                'token_expires_at' => $fresh->token_expires_at?->toIso8601String(),
                'revoked_at' => $fresh->revoked_at?->toIso8601String(),
                'updated_at' => $fresh->updated_at?->toIso8601String(),
            ] : null,
        ];
    }

    public function revokeAuthorizationForContext(User $user, string $context, bool $revokeRemote = true): array
    {
        $authorizations = $user->swcAuthorizations()
            ->where('auth_context', $context)
            ->get();

        return $this->revokeAuthorizationCollection($authorizations, $revokeRemote);
    }

    public function revokeAuthorizationsForUser(User $user, bool $revokeRemote = true): array
    {
        $authorizations = $user->swcAuthorizations()->get();

        return $this->revokeAuthorizationCollection($authorizations, $revokeRemote);
    }

    public function revokeAllAuthorizations(bool $revokeRemote = true): array
    {
        $authorizations = SwcAuthorization::query()->get();

        return $this->revokeAuthorizationCollection($authorizations, $revokeRemote);
    }

    protected function revokeAuthorizationCollection(Collection $authorizations, bool $revokeRemote): array
    {
        $processed = 0;
        $remoteAttempted = 0;
        $remoteRevoked = 0;
        $remoteErrors = 0;
        $localRevoked = 0;
        $details = [];

        foreach ($authorizations as $authorization) {
            if (!$authorization instanceof SwcAuthorization) {
                continue;
            }

            $processed += 1;
            $remoteResult = null;

            if ($revokeRemote) {
                $remoteResult = $this->revokeAtSwc($authorization);
                if ($remoteResult['attempted']) {
                    $remoteAttempted += 1;
                }
                if ($remoteResult['ok']) {
                    $remoteRevoked += 1;
                }
                if (!$remoteResult['ok'] && ($remoteResult['attempted'] || $remoteResult['error'])) {
                    $remoteErrors += 1;
                }
            }

            $this->hardRevokeLocalAuthorization($authorization);
            $localRevoked += 1;

            $details[] = [
                'authorization_id' => $authorization->id,
                'user_id' => $authorization->user_id,
                'auth_context' => $authorization->auth_context,
                'remote' => $remoteResult,
            ];
        }

        return [
            'processed' => $processed,
            'remote_attempted' => $remoteAttempted,
            'remote_revoked' => $remoteRevoked,
            'remote_errors' => $remoteErrors,
            'local_revoked' => $localRevoked,
            'details' => $details,
        ];
    }

    protected function revokeAtSwc(SwcAuthorization $authorization): array
    {
        if (empty($authorization->refresh_token_encrypted)) {
            return [
                'attempted' => false,
                'ok' => false,
                'status' => null,
                'error' => null,
            ];
        }

        try {
            $refreshToken = decrypt((string) $authorization->refresh_token_encrypted);
        } catch (\Throwable) {
            return [
                'attempted' => false,
                'ok' => false,
                'status' => null,
                'error' => 'refresh_token_decrypt_failed',
            ];
        }

        $refreshToken = trim((string) $refreshToken);
        $clientId = trim((string) Config::get('swc.client_id', ''));
        $revokeUrl = trim((string) Config::get('swc.revoke_url', 'https://www.swcombine.com/ws/oauth2/revoke'));

        if ($refreshToken === '' || $clientId === '' || $revokeUrl === '') {
            return [
                'attempted' => false,
                'ok' => false,
                'status' => null,
                'error' => 'revoke_config_or_token_missing',
            ];
        }

        try {
            $response = SwcHttp::make()->timeout(5)->get($revokeUrl, [
                'token' => $refreshToken,
                'client_id' => $clientId,
            ]);
        } catch (\Throwable $e) {
            Log::warning('SWC revoke token request failed (connection error)', [
                'authorization_id' => $authorization->id,
                'user_id' => $authorization->user_id,
                'auth_context' => $authorization->auth_context,
                'error' => $e->getMessage(),
            ]);
            return [
                'attempted' => true,
                'ok' => false,
                'status' => null,
                'error' => 'connection_error',
            ];
        }

        $ok = $response->status() === 200;

        if (!$ok) {
            Log::warning('SWC revoke token request failed', [
                'authorization_id' => $authorization->id,
                'user_id' => $authorization->user_id,
                'auth_context' => $authorization->auth_context,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }

        return [
            'attempted' => true,
            'ok' => $ok,
            'status' => $response->status(),
            'error' => $ok ? null : trim((string) $response->body()),
        ];
    }

    protected function hardRevokeLocalAuthorization(SwcAuthorization $authorization): void
    {
        $authorization->access_token_encrypted = null;
        $authorization->refresh_token_encrypted = null;
        $authorization->token_expires_at = null;
        $authorization->last_verified_at = now();
        $authorization->revoked_at = now();
        $authorization->save();
    }

    public function recordOauthTokenExchangeMetadata(
        User $user,
        string $context,
        array $tokenData,
        string $requestedAccessType
    ): void {
        $expiresIn = null;
        if (isset($tokenData['expires_in']) && is_numeric($tokenData['expires_in'])) {
            $expiresIn = (int) $tokenData['expires_in'];
        }

        $metadata = [
            'captured_at' => now()->toIso8601String(),
            'user_id' => (int) $user->id,
            'auth_context' => $context,
            'requested_access_type' => trim($requestedAccessType) !== '' ? trim($requestedAccessType) : null,
            'has_access_token' => !empty($tokenData['access_token']),
            'has_refresh_token' => !empty($tokenData['refresh_token']),
            'expires_in' => $expiresIn,
            'scope' => implode(' ', $this->normalizeScopeValue($tokenData['scope'] ?? null)),
            'response_keys' => array_values(array_map('strval', array_keys($tokenData))),
        ];

        try {
            Cache::put(
                $this->oauthTokenExchangeCacheKey((int) $user->id, $context),
                $metadata,
                now()->addDays(14)
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to store SWC OAuth token exchange metadata', [
                'user_id' => $user->id,
                'auth_context' => $context,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function getOauthTokenExchangeMetadata(User $user, string $context): ?array
    {
        try {
            $value = Cache::get($this->oauthTokenExchangeCacheKey((int) $user->id, $context));
            return is_array($value) ? $value : null;
        } catch (\Throwable $e) {
            Log::warning('Failed to read SWC OAuth token exchange metadata', [
                'user_id' => $user->id,
                'auth_context' => $context,
                'message' => $e->getMessage(),
            ]);
        }

        return null;
    }

    protected function oauthTokenExchangeCacheKey(int $userId, string $context): string
    {
        return sprintf('swc:oauth_exchange_debug:user:%d:context:%s', $userId, $context);
    }

    public function recordOauthAuthorizeRequestMetadata(
        User $user,
        string $context,
        array $authorizeParams
    ): void {
        $metadata = [
            'captured_at' => now()->toIso8601String(),
            'user_id' => (int) $user->id,
            'auth_context' => $context,
            'access_type' => isset($authorizeParams['access_type']) ? (string) $authorizeParams['access_type'] : null,
            'renew_previously_granted' => isset($authorizeParams['renew_previously_granted'])
                ? (string) $authorizeParams['renew_previously_granted']
                : null,
            'scope' => isset($authorizeParams['scope'])
                ? implode(' ', $this->normalizeScopeValue($authorizeParams['scope']))
                : null,
            'redirect_uri' => isset($authorizeParams['redirect_uri']) ? (string) $authorizeParams['redirect_uri'] : null,
            'response_type' => isset($authorizeParams['response_type']) ? (string) $authorizeParams['response_type'] : null,
            'param_keys' => array_values(array_map('strval', array_keys($authorizeParams))),
        ];

        try {
            Cache::put(
                $this->oauthAuthorizeRequestCacheKey((int) $user->id, $context),
                $metadata,
                now()->addDays(14)
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to store SWC OAuth authorize request metadata', [
                'user_id' => $user->id,
                'auth_context' => $context,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function getOauthAuthorizeRequestMetadata(User $user, string $context): ?array
    {
        try {
            $value = Cache::get($this->oauthAuthorizeRequestCacheKey((int) $user->id, $context));
            return is_array($value) ? $value : null;
        } catch (\Throwable $e) {
            Log::warning('Failed to read SWC OAuth authorize request metadata', [
                'user_id' => $user->id,
                'auth_context' => $context,
                'message' => $e->getMessage(),
            ]);
        }

        return null;
    }

    protected function oauthAuthorizeRequestCacheKey(int $userId, string $context): string
    {
        return sprintf('swc:oauth_authorize_debug:user:%d:context:%s', $userId, $context);
    }

    public function recordOauthCallbackMetadata(
        User $user,
        string $context,
        array $metadata
    ): void {
        $payload = [
            'captured_at' => now()->toIso8601String(),
            'user_id' => (int) $user->id,
            'auth_context' => $context,
            'code_present' => !empty($metadata['code_present']),
            'state_present' => !empty($metadata['state_present']),
            'error' => isset($metadata['error']) ? (string) $metadata['error'] : null,
            'error_description' => isset($metadata['error_description']) ? (string) $metadata['error_description'] : null,
        ];

        $this->putOauthTraceCache($this->oauthCallbackCacheKey((int) $user->id, $context), $payload, 'callback');
    }

    public function getOauthCallbackMetadata(User $user, string $context): ?array
    {
        return $this->getOauthTraceCache($this->oauthCallbackCacheKey((int) $user->id, $context), 'callback', $user, $context);
    }

    public function recordOauthTokenRequestMetadata(
        User $user,
        string $context,
        array $metadata
    ): void {
        $payload = [
            'captured_at' => now()->toIso8601String(),
            'user_id' => (int) $user->id,
            'auth_context' => $context,
            'token_url' => isset($metadata['token_url']) ? (string) $metadata['token_url'] : null,
            'grant_type' => isset($metadata['grant_type']) ? (string) $metadata['grant_type'] : null,
            'access_type' => isset($metadata['access_type']) ? (string) $metadata['access_type'] : null,
            'redirect_uri' => isset($metadata['redirect_uri']) ? (string) $metadata['redirect_uri'] : null,
            'code_present' => !empty($metadata['code_present']),
            'client_id_suffix' => isset($metadata['client_id']) ? substr((string) $metadata['client_id'], -8) : null,
            'has_client_secret' => !empty($metadata['has_client_secret']),
        ];

        $this->putOauthTraceCache($this->oauthTokenRequestCacheKey((int) $user->id, $context), $payload, 'token request');
    }

    public function getOauthTokenRequestMetadata(User $user, string $context): ?array
    {
        return $this->getOauthTraceCache($this->oauthTokenRequestCacheKey((int) $user->id, $context), 'token request', $user, $context);
    }

    public function recordOauthStoredAuthorizationMetadata(
        User $user,
        string $context,
        ?SwcAuthorization $authorization
    ): void {
        $payload = [
            'captured_at' => now()->toIso8601String(),
            'user_id' => (int) $user->id,
            'auth_context' => $context,
            'authorization_exists' => $authorization !== null,
            'has_access_token' => !empty($authorization?->access_token_encrypted),
            'has_refresh_token' => !empty($authorization?->refresh_token_encrypted),
            'token_expires_at' => $authorization?->token_expires_at?->toIso8601String(),
            'revoked_at' => $authorization?->revoked_at?->toIso8601String(),
            'granted_scopes' => $authorization?->granted_scopes,
        ];

        $this->putOauthTraceCache($this->oauthStoredAuthorizationCacheKey((int) $user->id, $context), $payload, 'stored authorization');
    }

    public function getOauthStoredAuthorizationMetadata(User $user, string $context): ?array
    {
        return $this->getOauthTraceCache($this->oauthStoredAuthorizationCacheKey((int) $user->id, $context), 'stored authorization', $user, $context);
    }

    protected function oauthCallbackCacheKey(int $userId, string $context): string
    {
        return sprintf('swc:oauth_callback_debug:user:%d:context:%s', $userId, $context);
    }

    protected function oauthTokenRequestCacheKey(int $userId, string $context): string
    {
        return sprintf('swc:oauth_token_request_debug:user:%d:context:%s', $userId, $context);
    }

    protected function oauthStoredAuthorizationCacheKey(int $userId, string $context): string
    {
        return sprintf('swc:oauth_stored_auth_debug:user:%d:context:%s', $userId, $context);
    }

    protected function putOauthTraceCache(string $key, array $payload, string $label): void
    {
        try {
            Cache::put($key, $payload, now()->addDays(14));
        } catch (\Throwable $e) {
            Log::warning(sprintf('Failed to store SWC OAuth %s metadata', $label), [
                'message' => $e->getMessage(),
            ]);
        }
    }

    protected function getOauthTraceCache(string $key, string $label, User $user, string $context): ?array
    {
        try {
            $value = Cache::get($key);
            return is_array($value) ? $value : null;
        } catch (\Throwable $e) {
            Log::warning(sprintf('Failed to read SWC OAuth %s metadata', $label), [
                'user_id' => $user->id,
                'auth_context' => $context,
                'message' => $e->getMessage(),
            ]);
        }

        return null;
    }

}
