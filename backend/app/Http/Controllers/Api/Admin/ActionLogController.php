<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminActionLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActionLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 100), 500));

        $query = AdminActionLog::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($area = trim((string) $request->query('area', ''))) {
            $query->where('area', $area);
        }

        if ($action = trim((string) $request->query('action', ''))) {
            $query->where('action', $action);
        }

        if ($targetType = trim((string) $request->query('target_type', ''))) {
            $query->where('target_type', $targetType);
        }

        if ($actorUserId = $request->query('actor_user_id')) {
            $query->where('actor_user_id', (int) $actorUserId);
        }

        if ($q = trim((string) $request->query('q', ''))) {
            $query->where(function ($sub) use ($q) {
                $sub->where('actor_handle', 'like', "%{$q}%")
                    ->orWhere('area', 'like', "%{$q}%")
                    ->orWhere('action', 'like', "%{$q}%")
                    ->orWhere('target_type', 'like', "%{$q}%")
                    ->orWhere('summary', 'like', "%{$q}%")
                    ->orWhere('ip_address', 'like', "%{$q}%");
            });
        }

        $logs = $query
            ->limit($limit)
            ->get()
            ->map(fn (AdminActionLog $log) => [
                'id' => $log->id,
                'actor_user_id' => $log->actor_user_id,
                'actor_handle' => $log->actor_handle,
                'area' => $log->area,
                'action' => $log->action,
                'target_type' => $log->target_type,
                'target_id' => $log->target_id,
                'summary' => $log->summary,
                'before' => $this->decodeJsonField($log->before_json),
                'after' => $this->decodeJsonField($log->after_json),
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'created_at' => optional($log->created_at)?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'logs' => $logs,
        ]);
    }

    private function decodeJsonField(?string $value): ?array
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }
}
