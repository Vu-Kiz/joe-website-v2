<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureFreshUserSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        $sessionVersion = $request->session()->get('auth_version');
        $currentVersion = (int) ($user->auth_version ?? 1);

        if ($sessionVersion === null) {
            if ($currentVersion <= 1) {
                $request->session()->put('auth_version', $currentVersion);
                return $next($request);
            }

            return $this->invalidate($request);
        }

        if ((int) $sessionVersion !== $currentVersion) {
            return $this->invalidate($request);
        }

        return $next($request);
    }

    protected function invalidate(Request $request): Response
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'ok' => false,
            'message' => 'Your session has been signed out. Please log in again.',
            'error_code' => 'session_invalidated',
        ], 401);
    }
}
