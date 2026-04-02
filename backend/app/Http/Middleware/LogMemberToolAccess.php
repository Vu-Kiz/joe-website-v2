<?php

namespace App\Http\Middleware;

use App\Support\Members\MemberToolAccessLogger;
use App\Support\Swc\Auth\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogMemberToolAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && !Permissions::hasAny($user, ['is_joe_member', 'is_admin', 'is_sysadmin'])) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have the required access for member tools.',
                'error_code' => 'permission_denied',
                'required_mode' => 'any',
                'required_flags' => ['is_joe_member', 'is_admin', 'is_sysadmin'],
                'sysadmin_override' => true,
            ], 403);
        }

        /** @var Response $response */
        $response = $next($request);

        $user = $request->user();
        if (!$user) {
            return $response;
        }

        [$area, $action] = $this->classify($request);

        MemberToolAccessLogger::log(
            $request,
            $area,
            $action,
            $this->buildSummary($request, $area, $action),
            $response->getStatusCode()
        );

        return $response;
    }

    private function classify(Request $request): array
    {
        $path = ltrim($request->path(), '/');
        $apiPath = preg_replace('/^api\//', '', $path) ?? $path;

        $area = match (true) {
            str_starts_with($apiPath, 'universe/') => 'galaxy',
            str_starts_with($apiPath, 'payments'),
            str_starts_with($apiPath, 'payment-transfers'),
            str_starts_with($apiPath, 'manual-payment-templates') => 'payments',
            str_starts_with($apiPath, 'jobs'),
            str_starts_with($apiPath, 'job-assignments') => 'jobs',
            str_starts_with($apiPath, 'factions') => 'factions',
            str_starts_with($apiPath, 'swc/authorization') => 'swc_authorization',
            default => 'member_tools',
        };

        $method = strtoupper($request->method());

        if (str_contains($apiPath, '/build-single') || str_contains($apiPath, '/build-bulk')) {
            return [$area, 'build'];
        }

        if (str_contains($apiPath, '/generate')) {
            return [$area, 'generate'];
        }

        if (str_contains($apiPath, '/verify')) {
            return [$area, 'verify'];
        }

        if (str_contains($apiPath, '/toggle')) {
            return [$area, 'toggle'];
        }

        if (preg_match('#/(take|complete|close|join)$#', $apiPath, $matches) === 1) {
            return [$area, $matches[1]];
        }

        $action = match ($method) {
            'GET' => 'view',
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'access',
        };

        if ($area === 'galaxy' && $method === 'POST' && str_contains($apiPath, 'cell-annotations')) {
            $action = 'annotate';
        }

        return [$area, $action];
    }

    private function buildSummary(Request $request, string $area, string $action): string
    {
        $areaLabel = ucwords(str_replace('_', ' ', $area));
        $path = '/' . ltrim($request->path(), '/');

        return sprintf('%s %s via %s %s', ucfirst($action), $areaLabel, strtoupper($request->method()), $path);
    }
}
