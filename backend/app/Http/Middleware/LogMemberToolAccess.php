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

        if ($this->shouldSkipLogging($request)) {
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

    private function shouldSkipLogging(Request $request): bool
    {
        $path = ltrim($request->path(), '/');
        $apiPath = preg_replace('/^api\//', '', $path) ?? $path;

        if ($apiPath === 'payments/pending-count') {
            return true;
        }

        if (strtoupper($request->method()) !== 'GET') {
            return false;
        }

        return in_array($apiPath, [
            'swc/authorization',
            'factions/mine',
            'factions/mine/payable',
            'factions/mine/privileges',
            'payments',
            'payments/owed-to-me',
            'payment-transfers',
            'payment-transfers/unverified-support',
            'manual-payment-templates',
            'manual-payment-templates/options',
        ], true);
    }

    private function classify(Request $request): array
    {
        $path = ltrim($request->path(), '/');
        $apiPath = preg_replace('/^api\//', '', $path) ?? $path;

        $area = match (true) {
            str_starts_with($apiPath, 'droidbrain') => 'droidbrain',
            str_starts_with($apiPath, 'payments/droidbrain-settings') => 'droidbrain',
            str_starts_with($apiPath, 'universe/archive/') => 'galactic_archive',
            str_starts_with($apiPath, 'universe/hyper-planner'),
            str_starts_with($apiPath, 'universe/hyper-plans') => 'hyper_planner',
            str_starts_with($apiPath, 'fleet/') => 'fleet_command',
            preg_match('#^universe/(station-types|facility-types|item-types|planet-types|ship-types|vehicle-types|droid-types|creature-types|npc-types|races|weapon-types|terrain-types|material-types)(/|$)#', $apiPath) === 1 => 'entity_stats',
            str_starts_with($apiPath, 'universe/') => 'astrogation',
            str_starts_with($apiPath, 'payments'),
            str_starts_with($apiPath, 'payment-transfers'),
            str_starts_with($apiPath, 'manual-payment-templates') => 'payments',
            str_starts_with($apiPath, 'jobs'),
            str_starts_with($apiPath, 'job-assignments') => 'jobs',
            str_starts_with($apiPath, 'factions') => 'factions',
            str_starts_with($apiPath, 'swc/authorization') => 'chain_code_verification',
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

        if ($area === 'astrogation' && $method === 'POST' && str_contains($apiPath, 'cell-annotations')) {
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
