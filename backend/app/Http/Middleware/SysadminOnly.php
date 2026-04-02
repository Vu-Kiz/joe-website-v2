<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Support\Swc\Auth\Permissions;

class SysadminOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated',
                'error_code' => 'unauthenticated',
            ], 401);
        }

        if (!Permissions::isSysadmin($user)) {
            return response()->json([
                'ok' => false,
                'message' => 'This action is restricted to sysadmins.',
                'error_code' => 'permission_denied',
                'required_mode' => 'all',
                'required_flags' => ['is_sysadmin'],
                'sysadmin_override' => false,
            ], 403);
        }

        return $next($request);
    }
}
