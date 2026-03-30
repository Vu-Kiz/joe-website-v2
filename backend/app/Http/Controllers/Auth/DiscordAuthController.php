<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DiscordAuthController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        $clientId = (string) Config::get('discord.client_id', '');
        $authorizeUrl = rtrim((string) Config::get('discord.authorize_url', ''), '/');
        $redirectUri = (string) Config::get('discord.redirect_uri', '');
        $scope = (string) Config::get('discord.scope', 'identify');

        if ($clientId === '' || $authorizeUrl === '' || $redirectUri === '') {
            abort(500, 'Discord OAuth is not configured correctly.');
        }

        $state = Str::random(32);
        $returnTo = (string) $request->query('return_to', '/home');

        $request->session()->put('discord_oauth_state', $state);
        $request->session()->put('discord_oauth_return_to', $returnTo);

        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => $clientId,
            'scope' => $scope,
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'prompt' => 'consent',
        ]);

        return redirect()->away("{$authorizeUrl}?{$query}");
    }

    public function callback(Request $request): RedirectResponse
    {
        $frontend = (string) Config::get('discord.frontend_url', Config::get('app.url', ''));
        $fallbackPath = '/home';

        try {
            $code = (string) $request->query('code', '');
            $state = (string) $request->query('state', '');
            $error = (string) $request->query('error', '');
            $errorDescription = (string) $request->query('error_description', '');

            if ($error !== '') {
                throw new \RuntimeException(
                    'Discord OAuth error: ' . $error . ($errorDescription !== '' ? ' - ' . $errorDescription : '')
                );
            }

            if ($code === '') {
                throw new \RuntimeException('Missing "code" parameter from Discord.');
            }

            $sessionState = (string) $request->session()->pull('discord_oauth_state', '');
            $returnTo = (string) $request->session()->pull('discord_oauth_return_to', $fallbackPath);

            if ($sessionState === '' || !hash_equals($sessionState, $state)) {
                throw new \RuntimeException('Invalid Discord OAuth state.');
            }

            $tokenData = $this->exchangeCodeForToken($code);
            $profile = $this->fetchDiscordProfile((string) ($tokenData['access_token'] ?? ''));

            $user = $this->upsertUserFromDiscordProfile($profile);

            Auth::login($user);
            $request->session()->regenerate();

            $target = $this->normalizeReturnTo($returnTo);

            return redirect()->away(rtrim($frontend, '/') . $target);
        } catch (\Throwable $e) {
            Log::warning('Discord OAuth callback failed', [
                'message' => $e->getMessage(),
                'full_url' => $request->fullUrl(),
            ]);

            $target = $fallbackPath . '?oauth_error=' . urlencode($e->getMessage());

            return redirect()->away(rtrim($frontend, '/') . $target);
        }
    }

    protected function exchangeCodeForToken(string $code): array
    {
        $redirectUri = (string) Config::get('discord.redirect_uri', '');
        $tokenUrl = rtrim((string) Config::get('discord.token_url', ''), '/');
        $clientId = (string) Config::get('discord.client_id', '');
        $clientSecret = (string) Config::get('discord.client_secret', '');

        $response = Http::asForm()->post($tokenUrl, [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $redirectUri,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
        ]);

        if (!$response->ok()) {
            $body = (string) $response->body();
            $payload = $response->json();
            $error = is_array($payload) ? (string) ($payload['error'] ?? '') : '';
            $errorDescription = is_array($payload) ? (string) ($payload['error_description'] ?? '') : '';

            Log::warning('Discord token exchange failed', [
                'status' => $response->status(),
                'body' => mb_substr($body, 0, 1000),
                'error' => $error,
                'error_description' => $errorDescription,
                'redirect_uri' => $redirectUri,
                'client_id_present' => $clientId !== '',
                'client_secret_present' => $clientSecret !== '',
            ]);

            $message = 'Discord token exchange failed (HTTP ' . $response->status() . ')';

            if ($error !== '') {
                $message .= ': ' . $error;
            }

            if ($errorDescription !== '') {
                $message .= ' - ' . $errorDescription;
            }

            throw new \RuntimeException(
                $message . '.'
            );
        }

        return $response->json() ?? [];
    }

    protected function fetchDiscordProfile(string $accessToken): array
    {
        if ($accessToken === '') {
            throw new \RuntimeException('Discord did not return an access token.');
        }

        $apiBase = rtrim((string) Config::get('discord.api_base', 'https://discord.com/api'), '/');

        $response = Http::withToken($accessToken)->acceptJson()->get($apiBase . '/users/@me');

        if (!$response->ok()) {
            throw new \RuntimeException('Could not fetch Discord profile.');
        }

        return $response->json() ?? [];
    }

    protected function upsertUserFromDiscordProfile(array $profile): User
    {
        $discordUserId = (string) ($profile['id'] ?? '');
        $username = (string) ($profile['username'] ?? '');
        $globalName = isset($profile['global_name']) ? (string) $profile['global_name'] : null;
        $avatar = isset($profile['avatar']) ? (string) $profile['avatar'] : null;

        if ($discordUserId === '' || $username === '') {
            throw new \RuntimeException('Discord profile response was missing identity details.');
        }

        $avatarUrl = $avatar
            ? sprintf('https://cdn.discordapp.com/avatars/%s/%s.png', $discordUserId, $avatar)
            : null;

        return User::updateOrCreate(
            ['discord_user_id' => $discordUserId],
            [
                'discord_username' => $username,
                'discord_global_name' => $globalName !== '' ? $globalName : null,
                'discord_avatar_url' => $avatarUrl,
                'discord_linked_at' => now(),
            ]
        );
    }

    protected function normalizeReturnTo(string $returnTo): string
    {
        if ($returnTo === '' || !str_starts_with($returnTo, '/')) {
            return '/home';
        }

        return $returnTo;
    }
}
