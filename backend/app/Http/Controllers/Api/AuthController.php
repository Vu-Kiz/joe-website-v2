<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'debug' => [
                'has_session_cookie' => $request->hasCookie(config('session.cookie')),
                'session_cookie_name' => config('session.cookie'),
                'session_id' => $request->session()->getId(),
                'auth_check' => Auth::check(),
            ],
            'user' => Auth::user() ? [
                'id' => Auth::user()->id,
                'discord_user_id' => Auth::user()->discord_user_id,
                'discord_username' => Auth::user()->discord_username,
                'discord_global_name' => Auth::user()->discord_global_name,
                'discord_avatar_url' => Auth::user()->discord_avatar_url,
                'swc_character_id' => Auth::user()->swc_character_id,
                'handle' => Auth::user()->swc_handle
                    ?: Auth::user()->discord_global_name
                    ?: Auth::user()->discord_username,
                'avatar_url' => Auth::user()->swc_avatar_url ?: Auth::user()->discord_avatar_url,
                'is_joe_member' => (bool) Auth::user()->is_joe_member,
                'is_admin' => (bool) Auth::user()->is_admin,
                'is_sysadmin' => (bool) Auth::user()->is_sysadmin,
                'is_intel' => (bool) Auth::user()->is_intel,
                'is_garry' => (bool) Auth::user()->is_garry,
                'is_raid' => (bool) Auth::user()->is_raid,
                'can_manage_blog' => (bool) Auth::user()->can_manage_blog,
            ] : null,
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }
}
