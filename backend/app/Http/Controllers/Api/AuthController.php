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
                'swc_character_id' => Auth::user()->swc_character_id,
                'handle' => Auth::user()->swc_handle,
                'avatar_url' => Auth::user()->swc_avatar_url,
                'is_joe_member' => (bool) Auth::user()->is_joe_member,
                'is_admin' => (bool) Auth::user()->is_admin,
                'is_sysadmin' => (bool) Auth::user()->is_sysadmin,
                'is_intel' => (bool) Auth::user()->is_intel,
                'is_garry' => (bool) Auth::user()->is_garry,
                'is_raid' => (bool) Auth::user()->is_raid,
            ] : null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }
}
