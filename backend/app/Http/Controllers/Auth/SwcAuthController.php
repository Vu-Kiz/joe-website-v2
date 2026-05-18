<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\SwcAuthorization;
use App\Models\User;
use App\Models\UserSwcAccount;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcHttp;
use App\Support\Swc\SwcFactionSyncService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SwcAuthController extends Controller
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService,
        protected SwcFactionSyncService $swcFactionSyncService
    ) {
    }

    public function redirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
            return redirect()->away($frontend . '/aboutme?oauth_error=' . urlencode('Sign in with Discord before linking SWC.'));
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_oauth_state',
            returnToSessionKey: null,
            returnTo: null,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.default_scope', 'character_read'),
            accessType: (string) Config::get('swc.access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_LINK_ACCOUNT
        );
    }

    public function creditLogRedirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
            return redirect()->away($frontend . '/payments');
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_creditlog_oauth_state',
            returnToSessionKey: null,
            returnTo: null,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get(
                'swc.creditlog_scope',
                'character_read character_credits character_credits_write faction_credits_read faction_credits_write character_privileges'
            ),
            accessType: (string) Config::get('swc.creditlog_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_PAYMENTS
        );
    }

    public function memberToolsRedirect(Request $request): RedirectResponse
    {
        $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
        $returnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->query('return_to', '/aboutme'),
            '/aboutme'
        );
        $selectedTools = $this->resolveRequestedMemberTools($request);
        $scope = $this->resolveMemberToolsScope($selectedTools);

        if (!Auth::check()) {
            return redirect()->away($frontend . $returnTo);
        }

        $user = Auth::user();
        if ($user) {
            $this->swcAuthorizationService->revokeAuthorizationForContext($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS);
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_member_tools_oauth_state',
            returnToSessionKey: 'swc_member_tools_oauth_return_to',
            returnTo: $returnTo,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: $scope,
            accessType: (string) Config::get('swc.member_tools_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            renewPreviouslyGranted: false
        );
    }

    public function publicToolsRedirect(Request $request): RedirectResponse
    {
        $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
        $returnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->query('return_to', '/aboutme'),
            '/aboutme'
        );
        $selectedTools = $this->resolveRequestedPublicTools($request);
        $scope = $this->resolvePublicToolsScope($selectedTools);

        if (!Auth::check()) {
            return redirect()->away($frontend . $returnTo);
        }

        $user = Auth::user();
        if ($user) {
            $this->swcAuthorizationService->revokeAuthorizationForContext($user, SwcAuthorization::CONTEXT_PUBLIC_TOOLS);
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_public_tools_oauth_state',
            returnToSessionKey: 'swc_public_tools_oauth_return_to',
            returnTo: $returnTo,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: $scope,
            accessType: (string) Config::get('swc.public_tools_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
            renewPreviouslyGranted: false
        );
    }

    public function eventsRedirect(Request $request): RedirectResponse
    {
        $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
        $returnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->query('return_to', '/sys/debug'),
            '/sys/debug'
        );

        if (!Auth::check()) {
            return redirect()->away($frontend . $returnTo);
        }

        $scope = trim((string) Config::get('swc.events_scope', ''));

        if ($scope === '') {
            return redirect()->away($frontend . $this->appendQueryParam($returnTo, 'swc_oauth_error', 'SWC events scope is not configured.'));
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_events_oauth_state',
            returnToSessionKey: 'swc_events_oauth_return_to',
            returnTo: $returnTo,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: $scope,
            accessType: (string) Config::get('swc.events_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_EVENTS
        );
    }

    public function debugRedirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
            return redirect()->away($frontend . '/sys/debug');
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_debug_oauth_state',
            returnToSessionKey: null,
            returnTo: null,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.debug_scope', 'character_all faction_all messages_all'),
            accessType: (string) Config::get('swc.debug_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_DEBUG
        );
    }

    public function marketFactionRedirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');
            return redirect()->away($frontend . '/sys/debug');
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_market_faction_oauth_state',
            returnToSessionKey: null,
            returnTo: null,
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.market_faction_scope', 'personal_inv_overview personal_inv_ships_all personal_inv_vehicles_all personal_inv_materials_all personal_inv_items_all personal_inv_droids_all personal_inv_stations_all personal_inv_cities_all personal_inv_facilities_all personal_inv_npcs_all personal_inv_creatures_all faction_inv_overview faction_inv_ships_all faction_inv_vehicles_all faction_inv_materials_all faction_inv_items_all faction_inv_droids_all faction_inv_stations_all character_privileges'),
            accessType: (string) Config::get('swc.market_faction_access_type', 'offline'),
            authContext: SwcAuthorization::CONTEXT_MARKET_FACTION
        );
    }

    public function callback(Request $request): RedirectResponse
    {
        $state = (string) $request->query('state', '');

        $normalState = (string) $request->session()->get('swc_oauth_state', '');
        $memberToolsState = (string) $request->session()->get('swc_member_tools_oauth_state', '');
        $publicToolsState = (string) $request->session()->get('swc_public_tools_oauth_state', '');
        $creditLogState = (string) $request->session()->get('swc_creditlog_oauth_state', '');
        $eventsState = (string) $request->session()->get('swc_events_oauth_state', '');
        $debugState = (string) $request->session()->get('swc_debug_oauth_state', '');
        $marketFactionState = (string) $request->session()->get('swc_market_faction_oauth_state', '');
        $memberToolsReturnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->session()->get('swc_member_tools_oauth_return_to', '/aboutme'),
            '/aboutme'
        );
        $publicToolsReturnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->session()->get('swc_public_tools_oauth_return_to', '/aboutme'),
            '/aboutme'
        );
        $eventsReturnTo = $this->sanitizeFrontendReturnPath(
            (string) $request->session()->get('swc_events_oauth_return_to', '/sys/debug'),
            '/sys/debug'
        );

        $frontend = (string) Config::get('swc.frontend_url', 'https://www.joe-swc.com');

        try {
            if ($memberToolsState !== '' && hash_equals($memberToolsState, $state)) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: 'swc_member_tools_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . $this->appendQueryParam(
                        $memberToolsReturnTo,
                        'swc_oauth_error',
                        'OAuth character does not match the current signed-in user.'
                    ));
                }

                Auth::login($oauthUser);
                $request->session()->regenerate();
                $request->session()->put('auth_version', (int) ($oauthUser->auth_version ?? 1));

                $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

                $authorization = $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes,
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS
                );
                $this->recordOauthTraceSteps(
                    $request,
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                    (string) Config::get('swc.redirect_uri', '')
                );
                $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                    $tokenData,
                    $this->normalizeAccessType((string) Config::get('swc.member_tools_access_type', 'offline'))
                );
                $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                    $authorization
                );

                return redirect()->away($frontend . $this->appendQueryParam(
                    $memberToolsReturnTo,
                    'swc_oauth_success',
                    '1'
                ));
            }

            if ($publicToolsState !== '' && hash_equals($publicToolsState, $state)) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: 'swc_public_tools_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . $this->appendQueryParam(
                        $publicToolsReturnTo,
                        'swc_oauth_error',
                        'OAuth character does not match the current signed-in user.'
                    ));
                }

                Auth::login($oauthUser);
                $request->session()->regenerate();
                $request->session()->put('auth_version', (int) ($oauthUser->auth_version ?? 1));

                $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

                $authorization = $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes,
                    SwcAuthorization::CONTEXT_PUBLIC_TOOLS
                );
                $this->recordOauthTraceSteps(
                    $request,
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
                    (string) Config::get('swc.redirect_uri', '')
                );
                $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
                    $tokenData,
                    $this->normalizeAccessType((string) Config::get('swc.public_tools_access_type', 'offline'))
                );
                $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
                    $authorization
                );

                return redirect()->away($frontend . $this->appendQueryParam(
                    $publicToolsReturnTo,
                    'swc_oauth_success',
                    '1'
                ));
            }

            if ($creditLogState !== '' && hash_equals($creditLogState, $state)) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: 'swc_creditlog_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . '/payments?creditlog_oauth_error=' . urlencode('Credit log OAuth character does not match the current signed-in user.'));
                }

                Auth::login($oauthUser);
                $request->session()->regenerate();
                $request->session()->put('auth_version', (int) ($oauthUser->auth_version ?? 1));

                $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

                $authorization = $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes,
                    SwcAuthorization::CONTEXT_PAYMENTS
                );
                $this->recordOauthTraceSteps(
                    $request,
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PAYMENTS,
                    (string) Config::get('swc.redirect_uri', '')
                );
                $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PAYMENTS,
                    $tokenData,
                    $this->normalizeAccessType((string) Config::get('swc.creditlog_access_type', 'offline'))
                );
                $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_PAYMENTS,
                    $authorization
                );

                return redirect()->away($frontend . '/payments');
            }

            if ($marketFactionState !== '' && hash_equals($marketFactionState, $state)) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: 'swc_market_faction_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . $this->appendQueryParam(
                        '/sys/debug',
                        'swc_oauth_error',
                        'OAuth character does not match the current signed-in user.'
                    ));
                }

                Auth::login($oauthUser);
                $request->session()->regenerate();
                $request->session()->put('auth_version', (int) ($oauthUser->auth_version ?? 1));

                $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

                $authorization = $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes,
                    SwcAuthorization::CONTEXT_MARKET_FACTION
                );
                $this->recordOauthTraceSteps(
                    $request,
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MARKET_FACTION,
                    (string) Config::get('swc.redirect_uri', '')
                );
                $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MARKET_FACTION,
                    $tokenData,
                    $this->normalizeAccessType((string) Config::get('swc.market_faction_access_type', 'offline'))
                );
                $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                    $oauthUser,
                    SwcAuthorization::CONTEXT_MARKET_FACTION,
                    $authorization
                );

                return redirect()->away($frontend . $this->appendQueryParam(
                    '/sys/debug',
                    'swc_oauth_success',
                    '1'
                ));
            }

            if (
                ($eventsState !== '' && hash_equals($eventsState, $state))
                || ($debugState !== '' && hash_equals($debugState, $state))
            ) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: $eventsState !== '' && hash_equals($eventsState, $state)
                        ? 'swc_events_oauth_state'
                        : 'swc_debug_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . $this->appendQueryParam(
                        $eventsState !== '' && hash_equals($eventsState, $state) ? $eventsReturnTo : '/sys/debug',
                        'swc_oauth_error',
                        'OAuth character does not match the current signed-in user.'
                    ));
                }

                Auth::login($oauthUser);
                $request->session()->regenerate();
                $request->session()->put('auth_version', (int) ($oauthUser->auth_version ?? 1));

                $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

                $context = $eventsState !== '' && hash_equals($eventsState, $state)
                    ? SwcAuthorization::CONTEXT_EVENTS
                    : SwcAuthorization::CONTEXT_DEBUG;

                $authorization = $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes,
                    $context
                );
                $this->recordOauthTraceSteps(
                    $request,
                    $oauthUser,
                    $context,
                    (string) Config::get('swc.redirect_uri', '')
                );
                $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                    $oauthUser,
                    $context,
                    $tokenData,
                    $this->normalizeAccessType((string) Config::get(
                        $context === SwcAuthorization::CONTEXT_EVENTS ? 'swc.events_access_type' : 'swc.debug_access_type',
                        'offline'
                    ))
                );
                $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                    $oauthUser,
                    $context,
                    $authorization
                );

                return redirect()->away($frontend . $this->appendQueryParam(
                    $eventsState !== '' && hash_equals($eventsState, $state) ? $eventsReturnTo : '/sys/debug',
                    'swc_oauth_success',
                    '1'
                ));
            }

            [$tokenData, $profile] = $this->handleCallbackForFlow(
                request: $request,
                stateSessionKey: 'swc_oauth_state',
                redirectUri: (string) Config::get('swc.redirect_uri', '')
            );

            $currentUser = Auth::user();

            if (!$currentUser) {
                throw new \RuntimeException('Sign in with Discord before linking SWC.');
            }

            $user = $this->linkSwcProfileToUser($currentUser, $profile);

            Auth::login($user);
            $request->session()->regenerate();
            $request->session()->put('auth_version', (int) ($user->auth_version ?? 1));

            $grantedScopes = $this->swcAuthorizationService->normalizeScopeValue($tokenData['scope'] ?? null);

            $authorization = $this->swcAuthorizationService->upsertAuthorization(
                $user,
                $tokenData,
                $grantedScopes,
                SwcAuthorization::CONTEXT_LINK_ACCOUNT
            );
            $this->recordOauthTraceSteps(
                $request,
                $user,
                SwcAuthorization::CONTEXT_LINK_ACCOUNT,
                (string) Config::get('swc.redirect_uri', '')
            );
            $this->swcAuthorizationService->recordOauthTokenExchangeMetadata(
                $user,
                SwcAuthorization::CONTEXT_LINK_ACCOUNT,
                $tokenData,
                $this->normalizeAccessType((string) Config::get('swc.access_type', 'offline'))
            );
            $this->swcAuthorizationService->recordOauthStoredAuthorizationMetadata(
                $user,
                SwcAuthorization::CONTEXT_LINK_ACCOUNT,
                $authorization
            );

            return redirect()->away($frontend . '/aboutme?swc_linked=1');
        } catch (\Throwable $e) {
            Log::warning('SWC OAuth callback failed', [
                'message' => $e->getMessage(),
                'full_url' => $request->fullUrl(),
            ]);

            if ($creditLogState !== '' && hash_equals($creditLogState, $state)) {
                return redirect()->away($frontend . '/payments?creditlog_oauth_error=' . urlencode($e->getMessage()));
            }

            if ($memberToolsState !== '' && hash_equals($memberToolsState, $state)) {
                return redirect()->away($frontend . $this->appendQueryParam(
                    $memberToolsReturnTo,
                    'swc_oauth_error',
                    $e->getMessage()
                ));
            }

            if ($publicToolsState !== '' && hash_equals($publicToolsState, $state)) {
                return redirect()->away($frontend . $this->appendQueryParam(
                    $publicToolsReturnTo,
                    'swc_oauth_error',
                    $e->getMessage()
                ));
            }

            if (
                ($eventsState !== '' && hash_equals($eventsState, $state))
                || ($debugState !== '' && hash_equals($debugState, $state))
            ) {
                return redirect()->away($frontend . $this->appendQueryParam(
                    ($eventsState !== '' && hash_equals($eventsState, $state)) ? $eventsReturnTo : '/sys/debug',
                    'swc_oauth_error',
                    $e->getMessage()
                ));
            }

            return redirect()->away($frontend . '/aboutme?oauth_error=' . urlencode($e->getMessage()));
        }
    }

    protected function redirectForFlow(
        Request $request,
        string $stateSessionKey,
        ?string $returnToSessionKey,
        ?string $returnTo,
        string $redirectUri,
        string $scope,
        string $accessType,
        string $authContext,
        bool $renewPreviouslyGranted = true
    ): RedirectResponse {
        $clientId     = (string) Config::get('swc.client_id', '');
        $authorizeUrl = rtrim((string) Config::get('swc.authorize_url', ''), '/');
        $accessType = $this->normalizeAccessType($accessType);

        if ($clientId === '' || $authorizeUrl === '' || $redirectUri === '') {
            Log::error('SWC OAuth misconfigured', [
                'client_id'     => $clientId !== '',
                'authorize_url' => $authorizeUrl !== '',
                'redirect_uri'  => $redirectUri !== '',
            ]);
            abort(500, 'SWC OAuth is not configured correctly.');
        }

        $state = Str::random(32);
        $request->session()->put($stateSessionKey, $state);
        if ($returnToSessionKey !== null) {
            $request->session()->put($returnToSessionKey, (string) $returnTo);
        }

        $queryParams = [
            'response_type' => 'code',
            'client_id'     => $clientId,
            'redirect_uri'  => $redirectUri,
            'scope'         => $scope,
            'state'         => $state,
            'access_type'   => $accessType,
        ];

        if ($renewPreviouslyGranted) {
            $queryParams['renew_previously_granted'] = 'yes';
        }

        $query = http_build_query($queryParams);

        $user = $request->user();
        if ($user) {
            $this->swcAuthorizationService->recordOauthAuthorizeRequestMetadata(
                $user,
                $authContext,
                $queryParams
            );
        }

        return redirect()->away("{$authorizeUrl}/?{$query}");
    }

    protected function normalizeAccessType(string $accessType): string
    {
        $normalized = strtolower(trim($accessType));

        if ($normalized !== 'offline') {
            Log::warning('SWC OAuth access_type coerced to offline', [
                'requested_access_type' => $accessType,
            ]);
        }

        // Force offline for every OAuth flow to support refresh tokens everywhere.
        return 'offline';
    }

    protected function recordOauthTraceSteps(
        Request $request,
        User $user,
        string $context,
        string $redirectUri
    ): void {
        $this->swcAuthorizationService->recordOauthCallbackMetadata($user, $context, [
            'code_present' => trim((string) $request->query('code', '')) !== '',
            'state_present' => trim((string) $request->query('state', '')) !== '',
            'error' => (string) $request->query('error', ''),
            'error_description' => (string) $request->query('error_description', ''),
        ]);

        $clientId = (string) Config::get('swc.client_id', '');
        $clientSecret = (string) Config::get('swc.client_secret', '');
        $tokenUrl = rtrim((string) Config::get('swc.token_url', ''), '/');
        $requestedAccessType = $this->normalizeAccessType((string) Config::get(match ($context) {
            SwcAuthorization::CONTEXT_MEMBER_TOOLS => 'swc.member_tools_access_type',
            SwcAuthorization::CONTEXT_PUBLIC_TOOLS => 'swc.public_tools_access_type',
            SwcAuthorization::CONTEXT_PAYMENTS => 'swc.creditlog_access_type',
            SwcAuthorization::CONTEXT_EVENTS => 'swc.events_access_type',
            SwcAuthorization::CONTEXT_DEBUG => 'swc.debug_access_type',
            default => 'swc.access_type',
        }, 'offline'));

        $this->swcAuthorizationService->recordOauthTokenRequestMetadata($user, $context, [
            'token_url' => $tokenUrl !== '' ? $tokenUrl . '/' : null,
            'grant_type' => 'authorization_code',
            'access_type' => $requestedAccessType,
            'redirect_uri' => $redirectUri,
            'code_present' => trim((string) $request->query('code', '')) !== '',
            'client_id' => $clientId,
            'has_client_secret' => trim($clientSecret) !== '',
        ]);
    }

    protected function sanitizeFrontendReturnPath(string $path, string $fallback): string
    {
        $trimmed = trim($path);

        if ($trimmed === '' || !str_starts_with($trimmed, '/') || str_starts_with($trimmed, '//')) {
            return $fallback;
        }

        return $trimmed;
    }

    protected function appendQueryParam(string $path, string $key, string $value): string
    {
        $separator = str_contains($path, '?') ? '&' : '?';

        return $path . $separator . urlencode($key) . '=' . urlencode($value);
    }

    /**
     * @return array<int, string>
     */
    protected function resolveRequestedMemberTools(Request $request): array
    {
        $raw = (string) $request->query('tools', '');
        $requestedTools = array_filter(array_map(
            static fn (string $tool): string => trim(Str::lower($tool)),
            explode(',', $raw)
        ));
        $toolsExplicitlyProvided = $request->query->has('tools');
        $disableAllRequested = in_array('none', $requestedTools, true) || in_array('off', $requestedTools, true);

        if ($disableAllRequested) {
            return [];
        }

        $allowedTools = array_keys((array) Config::get('swc.member_tool_scopes', []));
        $selectedTools = array_values(array_intersect($requestedTools, $allowedTools));

        if ($selectedTools !== []) {
            return $selectedTools;
        }

        if ($toolsExplicitlyProvided) {
            return [];
        }

        $savedPreferences = $request->user()?->member_tool_preferences;
        if (is_array($savedPreferences)) {
            $savedTools = [];
            foreach ($allowedTools as $tool) {
                if (!empty($savedPreferences[$tool])) {
                    $savedTools[] = $tool;
                }
            }

            if ($savedTools !== []) {
                return $savedTools;
            }
        }

        return $allowedTools;
    }

    /**
     * @param  array<int, string>  $selectedTools
     */
    protected function resolveMemberToolsScope(array $selectedTools): string
    {
        $toolScopes = (array) Config::get('swc.member_tool_scopes', []);
        $scopes = [];

        foreach ($selectedTools as $tool) {
            $scopeValue = trim((string) ($toolScopes[$tool] ?? ''));
            if ($scopeValue === '') {
                continue;
            }

            foreach (preg_split('/\s+/', $scopeValue) ?: [] as $scope) {
                $scope = trim($scope);
                if ($scope !== '') {
                    $scopes[] = $scope;
                }
            }
        }

        $scopes = array_values(array_unique($scopes));

        if ($scopes !== []) {
            return implode(' ', $scopes);
        }

        return (string) Config::get(
            'swc.member_tools_min_scope',
            (string) Config::get('swc.default_scope', 'character_read')
        );
    }

    /**
     * @return array<int, string>
     */
    protected function resolveRequestedPublicTools(Request $request): array
    {
        $raw = (string) $request->query('tools', '');
        $requestedTools = array_filter(array_map(
            static fn (string $tool): string => trim(Str::lower($tool)),
            explode(',', $raw)
        ));
        $toolsExplicitlyProvided = $request->query->has('tools');
        $disableAllRequested = in_array('none', $requestedTools, true) || in_array('off', $requestedTools, true);

        if ($disableAllRequested) {
            return [];
        }

        $allowedTools = array_keys((array) Config::get('swc.public_tool_scopes', []));
        $selectedTools = array_values(array_intersect($requestedTools, $allowedTools));

        if ($selectedTools !== []) {
            return $selectedTools;
        }

        if ($toolsExplicitlyProvided) {
            return [];
        }

        $savedPreferences = $request->user()?->public_tool_preferences;
        if (is_array($savedPreferences)) {
            $savedTools = [];
            foreach ($allowedTools as $tool) {
                if (!empty($savedPreferences[$tool])) {
                    $savedTools[] = $tool;
                }
            }

            if ($savedTools !== []) {
                return $savedTools;
            }
        }

        return $allowedTools;
    }

    /**
     * @param  array<int, string>  $selectedTools
     */
    protected function resolvePublicToolsScope(array $selectedTools): string
    {
        $toolScopes = (array) Config::get('swc.public_tool_scopes', []);
        $scopes = [];

        foreach ($selectedTools as $tool) {
            $scopeValue = trim((string) ($toolScopes[$tool] ?? ''));
            if ($scopeValue === '') {
                continue;
            }

            foreach (preg_split('/\s+/', $scopeValue) ?: [] as $scope) {
                $scope = trim($scope);
                if ($scope !== '') {
                    $scopes[] = $scope;
                }
            }
        }

        $scopes = array_values(array_unique($scopes));

        if ($scopes !== []) {
            return implode(' ', $scopes);
        }

        return (string) Config::get(
            'swc.public_tools_min_scope',
            (string) Config::get('swc.default_scope', 'character_read')
        );
    }

    protected function handleCallbackForFlow(
        Request $request,
        string $stateSessionKey,
        string $redirectUri
    ): array {
        $code  = (string) $request->query('code', '');
        $state = (string) $request->query('state', '');
        $error = (string) $request->query('error', '');
        $errorDescription = (string) $request->query('error_description', '');

        if ($error !== '') {
            throw new \RuntimeException(
                'SWC OAuth error: ' . $error . ($errorDescription !== '' ? ' - ' . $errorDescription : '')
            );
        }

        if ($code === '') {
            throw new \RuntimeException('Missing "code" parameter from SWC.');
        }

        $sessionState = (string) $request->session()->pull($stateSessionKey, '');
        if ($sessionState === '' || !hash_equals($sessionState, $state)) {
            throw new \RuntimeException('Invalid OAuth state.');
        }

        $clientId     = (string) Config::get('swc.client_id', '');
        $clientSecret = (string) Config::get('swc.client_secret', '');
        $tokenUrl     = rtrim((string) Config::get('swc.token_url', ''), '/');
        $requestedAccessType = $this->normalizeAccessType((string) Config::get(match ($stateSessionKey) {
            'swc_member_tools_oauth_state' => 'swc.member_tools_access_type',
            'swc_public_tools_oauth_state' => 'swc.public_tools_access_type',
            'swc_creditlog_oauth_state' => 'swc.creditlog_access_type',
            'swc_events_oauth_state' => 'swc.events_access_type',
            'swc_debug_oauth_state' => 'swc.debug_access_type',
            default => 'swc.access_type',
        }, 'offline'));

        $tokenRes = SwcHttp::make()
            ->acceptJson()
            ->asForm()
            ->post($tokenUrl . '/', [
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => $redirectUri,
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
                'access_type'   => $requestedAccessType,
            ]);

        if (!$tokenRes->ok()) {
            throw new \RuntimeException('SWC token exchange failed.');
        }

        $tokenData   = $tokenRes->json() ?? [];
        $accessToken = (string) ($tokenData['access_token'] ?? '');

        if ($accessToken === '') {
            throw new \RuntimeException('SWC response did not include an access_token.');
        }

        $apiBase    = rtrim((string) Config::get('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $profileUrl = $apiBase . '/character/';

        $profileRes = SwcHttp::make($accessToken)->get($profileUrl);

        if (!$profileRes->ok()) {
            throw new \RuntimeException('Could not fetch character profile from SWC.');
        }

        $profile = $profileRes->json() ?? [];

        return [$tokenData, $profile];
    }

    protected function upsertUserFromProfile(array $profile): User
    {
        $charUid  = (string) data_get($profile, 'swcapi.character.uid', '');
        $charName = (string) data_get($profile, 'swcapi.character.name', '');
        $avatar   = (string) data_get($profile, 'swcapi.character.image', '');

        if ($charUid === '' || $charName === '') {
            throw new \RuntimeException('SWC profile response was missing character details.');
        }

        $numericCharacterId = null;
        if (preg_match('/^1:(\d+)$/', $charUid, $matches)) {
            $numericCharacterId = (int) $matches[1];
        }

        if (!$numericCharacterId) {
            throw new \RuntimeException('Could not determine SWC character id.');
        }

        $existingUser = User::query()->where('swc_character_id', $numericCharacterId)->first();
        $lockFlags = $existingUser && $existingUser->lock_joe_flags;

        $updateData = [
            'swc_handle' => $charName,
            'swc_avatar_url' => $avatar !== '' ? $avatar : null,
        ];
        if (!$lockFlags) {
            $updateData['is_joe_member'] = $this->isJoeMemberInProfile($profile);
        }

        $user = User::updateOrCreate(
            ['swc_character_id' => $numericCharacterId],
            $updateData
        );

        $this->swcFactionSyncService->syncForUser($user, $profile);

        return $user;
    }

    protected function linkSwcProfileToUser(User $user, array $profile): User
    {
        $charUid = (string) data_get($profile, 'swcapi.character.uid', '');
        $charName = (string) data_get($profile, 'swcapi.character.name', '');
        $avatar = (string) data_get($profile, 'swcapi.character.image', '');

        if ($charUid === '' || $charName === '') {
            throw new \RuntimeException('SWC profile response was missing character details.');
        }

        if (!preg_match('/^1:(\d+)$/', $charUid, $matches)) {
            throw new \RuntimeException('Could not determine SWC character id.');
        }

        $numericCharacterId = (int) $matches[1];

        $existing = UserSwcAccount::query()
            ->where('swc_character_id', $numericCharacterId)
            ->where('user_id', '!=', $user->id)
            ->first();

        if ($existing) {
            throw new \RuntimeException('That SWC character is already linked to another account.');
        }

        UserSwcAccount::query()
            ->where('user_id', $user->id)
            ->where('is_primary', true)
            ->update([
                'is_primary' => false,
                'unlinked_at' => now(),
            ]);

        $account = UserSwcAccount::updateOrCreate(
            ['swc_character_id' => $numericCharacterId],
            [
                'user_id' => $user->id,
                'swc_handle' => $charName,
                'swc_avatar_url' => $avatar !== '' ? $avatar : null,
                'is_primary' => true,
                'linked_at' => now(),
                'last_seen_at' => now(),
                'unlinked_at' => null,
            ]
        );

        $fillData = [
            'swc_character_id' => $numericCharacterId,
            'swc_handle' => $charName,
            'swc_avatar_url' => $avatar !== '' ? $avatar : null,
        ];
        if (!$user->lock_joe_flags) {
            $fillData['is_joe_member'] = $this->isJoeMemberInProfile($profile);
        }
        $user->forceFill($fillData)->save();

        $this->swcFactionSyncService->syncForUser($user, $profile);

        return $user->fresh();
    }

    protected function isJoeMemberInProfile(array $profile): bool
    {
        $factions = $this->extractFactionsFromProfile($profile);

        foreach ($factions as $faction) {
            $name = trim((string) data_get($faction, 'value', data_get($faction, 'name', '')));
            if ($name === '') {
                continue;
            }

            $type = strtolower(trim((string) data_get($faction, 'attributes.type', '')));
            if ($type !== '' && str_contains($type, 'public')) {
                continue;
            }

            if (str_starts_with(strtolower($name), 'jawa offworld enterprises')) {
                return true;
            }
        }

        return false;
    }

    protected function extractFactionsFromProfile(array $profile): array
    {
        $candidates = [
            data_get($profile, 'swcapi.character.factions.faction'),
            data_get($profile, 'swcapi.character.factions'),
            data_get($profile, 'swcapi.character.faction'),
            data_get($profile, 'swcapi.factions.faction'),
            data_get($profile, 'swcapi.factions'),
        ];

        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }

            if ($this->isAssoc($candidate)) {
                if (isset($candidate['value']) || isset($candidate['name']) || isset($candidate['attributes'])) {
                    return [$candidate];
                }
            }

            return array_values(array_filter($candidate, fn ($item) => is_array($item)));
        }

        return [];
    }

    protected function isAssoc(array $array): bool
    {
        return array_keys($array) !== range(0, count($array) - 1);
    }

}
