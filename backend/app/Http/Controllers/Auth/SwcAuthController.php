<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Swc\SwcHttp;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SwcAuthController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        $clientId     = (string) Config::get('swc.client_id', '');
        $authorizeUrl = rtrim((string) Config::get('swc.authorize_url', ''), '/');
        $redirectUri  = (string) Config::get('swc.redirect_uri', '');
        $scope        = (string) Config::get('swc.default_scope', 'character_read');
        $accessType   = (string) Config::get('swc.access_type', 'online');

        if ($clientId === '' || $authorizeUrl === '' || $redirectUri === '') {
            Log::error('SWC OAuth misconfigured', [
                'client_id'     => $clientId !== '',
                'authorize_url' => $authorizeUrl !== '',
                'redirect_uri'  => $redirectUri !== '',
            ]);
            abort(500, 'SWC OAuth is not configured correctly.');
        }

        $state = Str::random(32);
        $request->session()->put('swc_oauth_state', $state);

        $query = http_build_query([
            'response_type' => 'code',
            'client_id'     => $clientId,
            'redirect_uri'  => $redirectUri,
            'scope'         => $scope,
            'state'         => $state,
            'access_type'   => $accessType, // online/offline
        ]);

        // Docs show /ws/oauth2/auth/ and query string
        return redirect()->away("{$authorizeUrl}/?{$query}");
    }

    public function callback(Request $request): RedirectResponse
    {
        $code  = (string) $request->query('code', '');
        $state = (string) $request->query('state', '');

        if ($code === '') {
            abort(400, 'Missing "code" parameter from SWC.');
        }

        $sessionState = (string) $request->session()->pull('swc_oauth_state', '');
        if ($sessionState === '' || !hash_equals($sessionState, $state)) {
            Log::warning('SWC OAuth state mismatch', [
                'session_state' => $sessionState,
                'query_state'   => $state,
            ]);
            abort(400, 'Invalid OAuth state.');
        }

        $clientId     = (string) Config::get('swc.client_id', '');
        $clientSecret = (string) Config::get('swc.client_secret', '');
        $tokenUrl     = rtrim((string) Config::get('swc.token_url', ''), '/');
        $redirectUri  = (string) Config::get('swc.redirect_uri', '');

        if ($clientId === '' || $clientSecret === '' || $tokenUrl === '' || $redirectUri === '') {
            Log::error('SWC OAuth token config missing', [
                'client_id'     => $clientId !== '',
                'client_secret' => $clientSecret !== '',
                'token_url'     => $tokenUrl !== '',
                'redirect_uri'  => $redirectUri !== '',
            ]);
            abort(500, 'SWC OAuth token configuration is incomplete.');
        }

        // Exchange code -> token
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
            Log::warning('SWC token exchange failed', [
                'status' => $tokenRes->status(),
                'body'   => $tokenRes->body(),
            ]);
            abort(502, 'SWC token exchange failed.');
        }

        $tokenData   = $tokenRes->json() ?? [];
        $accessToken = (string) ($tokenData['access_token'] ?? '');

        if ($accessToken === '') {
            Log::warning('SWC token response missing access_token', [
                'status' => $tokenRes->status(),
                'body'   => $tokenRes->body(),
                'json'   => $tokenData,
            ]);
            abort(502, 'SWC response did not include an access_token.');
        }

        // Fetch character (SWC returns JSON in your successful run)
        $apiBase    = rtrim((string) Config::get('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $profileUrl = $apiBase . '/character/';

        $profileRes = SwcHttp::make($accessToken)->get($profileUrl);

        if (!$profileRes->ok()) {
            Log::warning('SWC character fetch failed', [
                'url'    => $profileUrl,
                'status' => $profileRes->status(),
                'body'   => mb_substr((string) $profileRes->body(), 0, 800),
            ]);
            abort(502, 'Could not fetch character profile from SWC.');
        }

        $profile = $profileRes->json() ?? [];

        // Your payload shape: swcapi.character.uid/name/image/factions[]
        $charUid  = (string) data_get($profile, 'swcapi.character.uid', '');
        $charName = (string) data_get($profile, 'swcapi.character.name', '');
        $avatar   = (string) data_get($profile, 'swcapi.character.image', '');

        // UID looks like "1:1479821" -> take right side for numeric id
        $charId = null;
        if ($charUid !== '' && str_contains($charUid, ':')) {
            $parts = explode(':', $charUid);
            $maybe = end($parts);
            if (is_numeric($maybe)) $charId = (int) $maybe;
        }

        // Flags from factions array
        $factions = (array) data_get($profile, 'swcapi.character.factions', []);
        $factionNames = array_map(
            fn ($f) => (string) (is_array($f) ? ($f['value'] ?? '') : ''),
            $factions
        );

        $hasFaction = function (string $needle) use ($factionNames): bool {
            foreach ($factionNames as $n) {
                if (stripos($n, $needle) !== false) return true;
            }
            return false;
        };

        $isJoeMember = $hasFaction('Jawa Offworld Enterprises');
        $isGarry     = $hasFaction('GARRY');
        $isRaid      = $hasFaction('RAID');

        // Upsert user
        $user = null;

        if ($charId !== null) {
            $user = User::query()->where('swc_character_id', $charId)->first();
        }

        if (!$user) {
            $user = new User();
        }

        $user->swc_character_id = $charId;
        $user->swc_handle       = $charName !== '' ? $charName : null; // keep backticks exactly (Vu K`iz)
        $user->swc_avatar_url   = $avatar !== '' ? $avatar : null;

        $user->is_joe_member = $isJoeMember;
        $user->is_garry      = $isGarry;
        $user->is_raid       = $isRaid;

        // leave these false until you implement admin/sysadmin/intel gates
        $user->is_admin    = (bool) ($user->is_admin ?? false);
        $user->is_sysadmin = (bool) ($user->is_sysadmin ?? false);
        $user->is_intel    = (bool) ($user->is_intel ?? false);
        $user->can_manage_blog = (bool) ($user->can_manage_blog ?? false);

        $user->save();

        // Log the user in (session cookie)
        Auth::login($user);
        $request->session()->regenerate();

        // Send browser back to frontend
        $frontend = (string) Config::get('swc.frontend_url', 'https://dev-v2.swc-joe.com/home');

        return redirect()->away($frontend);
    }
}
