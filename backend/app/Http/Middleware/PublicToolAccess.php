<?php

namespace App\Http\Middleware;

use App\Support\ToolStore\ToolAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PublicToolAccess
{
    public function __construct(protected ToolAccessService $toolAccessService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $tier = $this->toolAccessService->tierForUser($user);

        if ($tier === ToolAccessService::TIER_NONE) {
            return response()->json([
                'ok' => false,
                'message' => 'An active tool subscription is required to access this resource.',
                'error_code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
