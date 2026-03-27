<?php

namespace App\Support\Members;

use App\Models\MemberAccessLog;
use Illuminate\Http\Request;

class MemberToolAccessLogger
{
    public static function log(
        Request $request,
        string $area,
        string $action,
        string $summary,
        ?int $responseStatus = null
    ): void {
        $user = $request->user();

        MemberAccessLog::create([
            'actor_user_id' => $user?->id,
            'actor_handle' => $user?->swc_handle ?? $user?->handle ?? null,
            'area' => $area,
            'action' => $action,
            'request_method' => strtoupper($request->method()),
            'request_path' => '/' . ltrim($request->path(), '/'),
            'summary' => $summary,
            'response_status' => $responseStatus,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 65535),
            'created_at' => now(),
        ]);
    }
}
