<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CanManageBlog
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        // Treat "admin and higher" as: is_admin OR is_sysadmin
        // plus explicit can_manage_blog.
        $allowed =
            (bool)($user->can_manage_blog ?? false) ||
            (bool)($user->is_admin ?? false) ||
            (bool)($user->is_sysadmin ?? false);

        if (!$allowed) {
            return response()->json([
                'ok' => false,
                'message' => 'Forbidden',
            ], 403);
        }

        return $next($request);
    }
}