<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class AuthenticateDiscordBot
{
    public function handle(Request $request, Closure $next): mixed
    {
        $expected = trim((string) Config::get('services.discord_bot.shared_token', ''));
        $provided = trim((string) $request->bearerToken());

        if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
            return response()->json([
                'ok' => false,
                'message' => 'Invalid Discord bot token.',
                'error_code' => 'invalid_discord_bot_token',
            ], 401);
        }

        return $next($request);
    }
}
