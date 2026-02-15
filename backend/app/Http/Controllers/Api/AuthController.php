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
        $user = Auth::user();

        if (! $user) {
            return response()->json([
                'ok'   => true,
                'user' => null,
            ]);
        }

        return response()->json([
            'ok'   => true,
            'user' => [
                'id'              => $user->id,
                'name'            => $user->name,
                'handle'          => $user->swc_handle,
                'avatarUrl'       => $user->swc_avatar_url,
                'swcCharacterId'  => $user->swc_character_id,
                'isJoeMember'     => $user->is_joe_member,
                'isAdmin'         => $user->is_admin,
                'isSysadmin'      => $user->is_sysadmin,
                'isIntel'         => $user->is_intel,
                'isGarry'         => $user->is_garry,
                'isRaid'          => $user->is_raid,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'ok' => true,
        ]);
    }
}
