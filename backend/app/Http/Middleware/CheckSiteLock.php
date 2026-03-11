<?php

namespace App\Http\Middleware;

use App\Support\Admin\SiteLock;
use App\Support\Swc\Auth\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSiteLock
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            if (! SiteLock::isEnabled()) {
                return $next($request);
            }

            if ($this->isAllowedDuringLock($request)) {
                return $next($request);
            }

            $user = auth()->user();

            if ($user && Permissions::isSysadmin($user)) {
                return $next($request);
            }

            return response()->json([
                'ok' => false,
                'site_locked' => true,
                'message' => SiteLock::getMessage(),
            ], 503);
        } catch (\Throwable $e) {
            return $next($request);
        }
    }

    protected function isAllowedDuringLock(Request $request): bool
    {
        return $request->is([
            'oauth',
            'oauth/callback',

            'api/auth/me',
            'api/auth/logout',
            'api/auth/*',

            // allow the sysadmin lock control endpoint to be reached
            'api/admin/site-lock',

            'api/site-lock-status',

            'sanctum/csrf-cookie',
            'build/*',
            'assets/*',
            'favicon.ico',
        ]);
    }
}