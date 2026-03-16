<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
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
        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_oauth_state',
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.default_scope', 'character_read'),
            accessType: (string) Config::get('swc.access_type', 'online')
        );
    }

    public function eventsRedirect(Request $request): RedirectResponse
    {
        if (!Auth::check()) {
            $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com');
            return redirect()->away($frontend . '/payments');
        }

        return $this->redirectForFlow(
            request: $request,
            stateSessionKey: 'swc_events_oauth_state',
            redirectUri: (string) Config::get('swc.redirect_uri', ''),
            scope: (string) Config::get('swc.events_scope', 'character_read character_events'),
            accessType: (string) Config::get('swc.events_access_type', 'offline')
        );
    }

    public function callback(Request $request): RedirectResponse
    {
        $state = (string) $request->query('state', '');

        $normalState = (string) $request->session()->get('swc_oauth_state', '');
        $eventsState = (string) $request->session()->get('swc_events_oauth_state', '');

        $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com');

        try {
            if ($eventsState !== '' && hash_equals($eventsState, $state)) {
                [$tokenData, $profile] = $this->handleCallbackForFlow(
                    request: $request,
                    stateSessionKey: 'swc_events_oauth_state',
                    redirectUri: (string) Config::get('swc.redirect_uri', '')
                );

                $oauthUser = $this->upsertUserFromProfile($profile);
                $currentUser = Auth::user();

                if ($currentUser && (int) $currentUser->id !== (int) $oauthUser->id) {
                    return redirect()->away($frontend . '/payments?events_oauth_error=' . urlencode('Events OAuth character does not match the current signed-in user.'));
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

            $user = $this->upsertUserFromProfile($profile);

            Auth::login($user);
            $request->session()->regenerate();

            return redirect()->away($frontend);
        } catch (\Throwable $e) {
            Log::warning('SWC OAuth callback failed', [
                'message' => $e->getMessage(),
                'full_url' => $request->fullUrl(),
            ]);

            if ($eventsState !== '' && hash_equals($eventsState, $state)) {
                return redirect()->away($frontend . '/payments?events_oauth_error=' . urlencode($e->getMessage()));
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

        $charId = null;
        if ($charUid !== '' && str_contains($charUid, ':')) {
            $parts = explode(':', $charUid);
            $maybe = end($parts);
            if (is_numeric($maybe)) {
                $charId = (int) $maybe;
            }
        }

        $factions = (array) data_get($profile, 'swcapi.character.factions', []);
        $factionNames = array_map(
            fn ($f) => (string) (is_array($f) ? ($f['value'] ?? '') : ''),
            $factions
        );
        
        Log::info('SWC profile factions', [
            'factions_raw' => $factions,
            'factions_names' => $factionNames,
        ]);

        $hasFaction = function (string $needle) use ($factionNames): bool {
            foreach ($factionNames as $n) {
                if (stripos($n, $needle) !== false) {
                    return true;
                }
            }
            return false;
        };

        $isJoeMember = $hasFaction('Jawa Offworld Enterprises');
        $isGarry     = $hasFaction('GARRY');
        $isRaid      = $hasFaction('RAID');

        $user = null;

        if ($charId !== null) {
            $user = User::query()->where('swc_character_id', $charId)->first();
        }

        if (!$user) {
            $user = new User();
        }

        $user->swc_character_id = $charId;
        $user->swc_handle       = $charName !== '' ? $charName : null;
        $user->swc_avatar_url   = $avatar !== '' ? $avatar : null;

        $user->is_joe_member = $isJoeMember;
        $user->is_garry      = $isGarry;
        $user->is_raid       = $isRaid;

        $user->is_admin        = (bool) ($user->is_admin ?? false);
        $user->is_sysadmin     = (bool) ($user->is_sysadmin ?? false);
        $user->is_intel        = (bool) ($user->is_intel ?? false);
        $user->can_manage_blog = (bool) ($user->can_manage_blog ?? false);

        $user->save();
        try {
            $this->swcFactionSyncService->syncUserFactions($user, $factions);
        } catch (\Exception $e) {
            \Log::error('Failed to sync user factions.', [
                'user_id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'message' => $e->getMessage(),
            ]);
        }
        return $user->fresh();
    }

    protected function normalizeScopes(mixed $scopeValue): array
    {
        if (is_array($scopeValue)) {
            return array_values(array_filter(array_map('strval', $scopeValue)));
        }

        if (is_string($scopeValue) && trim($scopeValue) !== '') {
            return preg_split('/\s+/', trim($scopeValue)) ?: [];
        }

        return [];
    }
}