<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Admin\SiteLock;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Http\JsonResponse;

class SiteLockStatusController extends Controller
{
    public function show(): JsonResponse
    {
        $user = auth()->user();

        return response()->json([
            'ok' => true,
            'site_lock' => [
                'enabled' => SiteLock::isEnabled(),
                'message' => SiteLock::getMessage(),
            ],
            'is_authenticated' => (bool) $user,
            'can_bypass' => $user ? Permissions::isSysadmin($user) : false,
        ]);
    }
}