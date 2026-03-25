<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
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
            $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com');
            return redirect()->away($frontend . '/home?oauth_error=' . urlencode('Sign in with Discord before linking SWC.'));
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_oauth_state',
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.default_scope', 'character_read'),
            accessType: (string) Config::get('swc.access_type', 'online')
        );
    }

    public function creditLogRedirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com');
            return redirect()->away($frontend . '/payments');
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_creditlog_oauth_state',
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get(
                'swc.creditlog_scope',
                'character_read character_credits faction_credits_read character_privileges'
            ),
            accessType: (string) Config::get('swc.creditlog_access_type', 'offline')
        );
    }

    public function callback(Request $request): RedirectResponse
    {
        $state = (string) $request->query('state', '');

        $normalState = (string) $request->session()->get('swc_oauth_state', '');
        $creditLogState = (string) $request->session()->get('swc_creditlog_oauth_state', '');

        $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com');

        try {
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

                $grantedScopes = $this->normalizeScopes($tokenData['scope'] ?? null);

                $this->swcAuthorizationService->upsertAuthorization(
                    $oauthUser,
                    $tokenData,
                    $grantedScopes
                );

                return redirect()->away($frontend . '/payments');
            }

            [, $profile] = $this->handleCallbackForFlow(
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

            return redirect()->away($frontend . '/aboutme?swc_linked=1');
        } catch (\Throwable $e) {
            Log::warning('SWC OAuth callback failed', [
                'message' => $e->getMessage(),
                'full_url' => $request->fullUrl(),
            ]);

            if ($creditLogState !== '' && hash_equals($creditLogState, $state)) {
                return redirect()->away($frontend . '/payments?creditlog_oauth_error=' . urlencode($e->getMessage()));
            }

            return redirect()->away($frontend . '/?oauth_error=' . urlencode($e->getMessage()));
        }
    }

    protected function redirectForFlow(
        Request $request,
        string $stateSessionKey,
        string $redirectUri,
        string $scope,
        string $accessType
    ): RedirectResponse {
        $clientId     = (string) Config::get('swc.client_id', '');
        $authorizeUrl = rtrim((string) Config::get('swc.authorize_url', ''), '/');

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

        $query = http_build_query([
            'response_type' => 'code',
            'client_id'     => $clientId,
            'redirect_uri'  => $redirectUri,
            'scope'         => $scope,
            'state'         => $state,
            'access_type'   => $accessType,
        ]);

        return redirect()->away("{$authorizeUrl}/?{$query}");
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

        $tokenRes = SwcHttp::make()
            ->asForm()
            ->post($tokenUrl . '/', [
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => $redirectUri,
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
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

        $user = User::updateOrCreate(
            ['swc_character_id' => $numericCharacterId],
            [
                'swc_handle' => $charName,
                'swc_avatar_url' => $avatar !== '' ? $avatar : null,
                'is_joe_member' => true,
            ]
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

        $user->forceFill([
            'swc_character_id' => $numericCharacterId,
            'swc_handle' => $charName,
            'swc_avatar_url' => $avatar !== '' ? $avatar : null,
            'is_joe_member' => true,
        ])->save();

        $this->swcFactionSyncService->syncForUser($user, $profile);

        return $user->fresh();
    }

    protected function normalizeScopes(mixed $scopeValue): array
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
