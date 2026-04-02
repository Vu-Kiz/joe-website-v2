<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Support\Swc\Auth\Permissions;

class RequireAnyFlag
{
    public function handle(Request $request, Closure $next, string $flagsCsv, string $sysadminOverrides = '1'): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated',
                'error_code' => 'unauthenticated',
            ], 401);
        }

        $flags = array_values(array_filter(array_map('trim', explode(',', $flagsCsv))));
        $sysOk = $sysadminOverrides !== '0';

        if (!Permissions::hasAny($user, $flags, $sysOk)) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have the required access for this tool.',
                'error_code' => 'permission_denied',
                'required_mode' => 'any',
                'required_flags' => $flags,
                'sysadmin_override' => $sysOk,
            ], 403);
        }

        return $next($request);
    }
}
