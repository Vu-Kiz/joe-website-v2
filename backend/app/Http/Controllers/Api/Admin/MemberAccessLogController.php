<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MemberAccessLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberAccessLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 250), 500));

        $query = MemberAccessLog::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($area = trim((string) $request->query('area', ''))) {
            $query->where('area', $area);
        }

        if ($action = trim((string) $request->query('action', ''))) {
            $query->where('action', $action);
        }

        if ($method = trim((string) $request->query('request_method', ''))) {
            $query->where('request_method', strtoupper($method));
        }

        if ($actorUserId = $request->query('actor_user_id')) {
            $query->where('actor_user_id', (int) $actorUserId);
        }

        if ($q = trim((string) $request->query('q', ''))) {
            $query->where(function ($sub) use ($q) {
                $sub->where('actor_handle', 'like', "%{$q}%")
                    ->orWhere('area', 'like', "%{$q}%")
                    ->orWhere('action', 'like', "%{$q}%")
                    ->orWhere('request_path', 'like', "%{$q}%")
                    ->orWhere('summary', 'like', "%{$q}%")
                    ->orWhere('ip_address', 'like', "%{$q}%");
            });
        }

        $logs = $query
            ->limit($limit)
            ->get()
            ->map(fn (MemberAccessLog $log) => [
                'id' => $log->id,
                'actor_user_id' => $log->actor_user_id,
                'actor_handle' => $log->actor_handle,
                'area' => $log->area,
                'action' => $log->action,
                'request_method' => $log->request_method,
                'request_path' => $log->request_path,
                'summary' => $log->summary,
                'response_status' => $log->response_status,
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
}
