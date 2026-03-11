<?php

namespace App\Support\Admin;

use App\Models\AdminActionLog;
use Illuminate\Http\Request;

class AdminActionLogger
{
    public static function log(
        Request $request,
        string $area,
        string $action,
        string $summary,
        ?string $targetType = null,
        int|string|null $targetId = null,
        array|null $before = null,
        array|null $after = null
    ): void {
        $user = $request->user();

        AdminActionLog::create([
            'actor_user_id' => $user?->id,
            'actor_handle'  => $user?->swc_handle ?? $user?->handle ?? null,
            'area'          => $area,
            'action'        => $action,
            'target_type'   => $targetType,
            'target_id'     => $targetId !== null ? (int) $targetId : null,
            'summary'       => $summary,
            'before_json'   => $before !== null ? json_encode($before, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'after_json'    => $after !== null ? json_encode($after, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'ip_address'    => $request->ip(),
            'user_agent'    => substr((string) $request->userAgent(), 0, 65535),
            'created_at'    => now(),
        ]);
    }
}