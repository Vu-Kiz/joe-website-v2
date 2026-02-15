<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\ApiClient;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SwcAuthController extends Controller
{
    /**
     * Step 1: Redirect user to SWC OAuth authorize endpoint.
     */
    public function redirect(Request $request): RedirectResponse
    {
        $clientId     = Config::get('swc.client_id');
        $authorizeUrl = rtrim((string) Config::get('swc.authorize_url'), '/');
        $redirectUri  = Config::get('swc.redirect_uri');
        $scope        = Config::get('swc.default_scope', 'character_read');

        if (! $clientId || ! $authorizeUrl || ! $redirectUri) {
            Log::error('SWC OAuth misconfigured', [
                'client_id'     => (bool) $clientId,
                'authorize_url' => (bool) $authorizeUrl,
                'redirect_uri'  => (bool) $redirectUri,
            ]);

            abort(500, 'SWC OAuth is not configured correctly.');
        }

        // CSRF protection – store state in the session
        $state = Str::random(32);
        $request->session()->put('swc_oauth_state', $state);

        $query = http_build_query([
            'response_type' => 'code',
            'client_id'     => $clientId,
            'redirect_uri'  => $redirectUri,
            'scope'         => $scope,
            // if you want offline refresh tokens:
            // 'access_type'   => 'offline',
            'state'         => $state,
        ]);

        return redirect()->away("{$authorizeUrl}?{$query}");
    }

    /**
     * Step 2: SWC redirects back here with ?code=&state=...
     *
     * CURRENTLY: debug mode – we stop after exchanging the code and dump
     * the raw token response so we can see exactly what SWC sends back.
     */
    public function callback(Request $request): JsonResponse
    {
        $code  = $request->query('code');
        $state = $request->query('state');

        if (! $code) {
            return response()->json([
                'ok'    => false,
                'step'  => 'callback-error',
                'error' => 'Missing "code" parameter from SWC.',
            ], 400);
        }

        // CSRF / state check
        $sessionState = $request->session()->pull('swc_oauth_state');

        if (! $sessionState || ! hash_equals((string) $sessionState, (string) $state)) {
            Log::warning('SWC OAuth state mismatch', [
                'session_state' => $sessionState,
                'query_state'   => $state,
            ]);

            return response()->json([
                'ok'    => false,
                'step'  => 'callback-error',
                'error' => 'Invalid OAuth state.',
            ], 400);
        }

        $clientId     = Config::get('swc.client_id');
        $clientSecret = Config::get('swc.client_secret');
        $tokenUrl     = rtrim((string) Config::get('swc.token_url'), '/');
        $redirectUri  = Config::get('swc.redirect_uri');

        if (! $clientId || ! $clientSecret || ! $tokenUrl || ! $redirectUri) {
            Log::error('SWC OAuth token config missing', [
                'client_id'     => (bool) $clientId,
                'client_secret' => (bool) $clientSecret,
                'token_url'     => (bool) $tokenUrl,
                'redirect_uri'  => (bool) $redirectUri,
            ]);

            return response()->json([
                'ok'    => false,
                'step'  => 'callback-error',
                'error' => 'SWC OAuth token configuration is incomplete.',
            ], 500);
        }

        // --- Step 2a: Exchange code for token, with SWC headers set ---
        try {
            $tokenResponse = ApiClient::swc()
                ->asForm()
                ->post($tokenUrl, [
                    'grant_type'    => 'authorization_code',
                    'code'          => $code,
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'redirect_uri'  => $redirectUri,
                ]);
        } catch (\Throwable $e) {
            Log::error('SWC OAuth token request failed', [
                'exception'   => $e->getMessage(),
                'token_url'   => $tokenUrl,
                'redirectUri' => $redirectUri,
            ]);

            return response()->json([
                'ok'         => false,
                'step'       => 'token-request-exception',
                'error'      => 'Exception during SWC token request.',
                'token_url'  => $tokenUrl,
                'exception'  => $e->getMessage(),
                'exception_class' => get_class($e),
            ], 502);
        }

        $payload = [
            'code'         => $code,
            'client_id'    => $clientId,
            'client_secret'=> '[redacted]', // don’t echo secrets back
            'redirect_uri' => $redirectUri,
            'grant_type'   => 'authorization_code',
        ];

        // 🔍 DEBUG: show exactly what SWC returned
        return response()->json([
            'ok'        => true,
            'step'      => 'debug-token',
            'status'    => $tokenResponse->status(),
            'payload'   => $payload,
            'headers'   => $tokenResponse->headers(),
            'raw_body'  => $tokenResponse->body(),
            'json_body' => $tokenResponse->json(),
        ]);
    }
}
