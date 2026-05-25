<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Swc;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SwcStatusController extends Controller
{
    private const CACHE_KEY      = 'swc_uptime_status';
    private const CACHE_TTL_MINS = 30;

    /**
     * Public endpoint — returns current SWC up/down status.
     * Frontend polls this every 60 seconds.
     */
    public function status(): JsonResponse
    {
        $cached = Cache::get(self::CACHE_KEY);

        if ($cached === null) {
            $cached = $this->fetchFromApi();
        }

        return response()->json([
            'ok'           => true,
            'down'         => (bool) ($cached['down'] ?? false),
            'monitor_name' => (string) ($cached['monitor_name'] ?? 'SWC'),
            'checked_at'   => $cached['checked_at'] ?? null,
        ]);
    }

    /**
     * Webhook endpoint — Uptime Kuma POSTs here when a monitor status changes.
     * Add X-Webhook-Token header in Uptime Kuma → Notifications → Custom Headers.
     */
    public function webhook(Request $request): JsonResponse
    {
        $expectedToken = config('services.uptime_kuma.webhook_token', '');

        if ($expectedToken !== '' && $request->header('X-Webhook-Token') !== $expectedToken) {
            Log::warning('SWC status webhook rejected — invalid token.');
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 401);
        }

        $heartbeat = $request->input('heartbeat');
        $monitor   = $request->input('monitor', []);

        // Uptime Kuma sends heartbeat=null on test notifications — treat as up
        if ($heartbeat === null) {
            $monitorName = is_array($monitor) ? (string) ($monitor['name'] ?? 'SWC') : 'SWC';
            Log::info(sprintf('SWC status webhook: test notification received for %s.', $monitorName));
            return response()->json(['ok' => true, 'test' => true]);
        }

        if (!is_array($heartbeat)) {
            return response()->json(['ok' => false, 'message' => 'Invalid payload.'], 422);
        }

        $status      = (int) ($heartbeat['status'] ?? 1);
        $monitorName = is_array($monitor) ? (string) ($monitor['name'] ?? 'SWC') : 'SWC';
        $isDown      = $status === 0;

        $payload = [
            'down'         => $isDown,
            'monitor_name' => $monitorName,
            'checked_at'   => now()->toIso8601String(),
        ];

        Cache::put(self::CACHE_KEY, $payload, now()->addMinutes(self::CACHE_TTL_MINS));

        Log::info(sprintf('SWC status webhook: %s is %s.', $monitorName, $isDown ? 'DOWN' : 'UP'));

        return response()->json(['ok' => true]);
    }

    /**
     * Fallback: poll Uptime Kuma API directly if cache is cold.
     */
    private function fetchFromApi(): array
    {
        $baseUrl   = rtrim((string) config('services.uptime_kuma.url', ''), '/');
        $apiKey    = (string) config('services.uptime_kuma.api_key', '');
        $monitorId = (string) config('services.uptime_kuma.monitor_id', '');

        $default = [
            'down'         => false,
            'monitor_name' => 'SWC',
            'checked_at'   => now()->toIso8601String(),
        ];

        if ($baseUrl === '' || $apiKey === '' || $monitorId === '') {
            return $default;
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(5)
                ->get("{$baseUrl}/api/monitor/{$monitorId}");

            if (!$response->successful()) {
                return $default;
            }

            $data        = $response->json();
            $monitorData = $data['monitor'] ?? $data['data'] ?? [];
            $name        = is_array($monitorData) ? (string) ($monitorData['name'] ?? 'SWC') : 'SWC';

            // Uptime Kuma monitor status: 0 = down, 1 = up, 2 = pending, 3 = maintenance
            $monitorStatus = is_array($monitorData) ? (int) ($monitorData['active'] ?? 1) : 1;
            $heartbeats    = $data['heartbeatList'] ?? $data['importantHeartbeatList'] ?? [];
            $latestStatus  = 1;

            if (is_array($heartbeats) && !empty($heartbeats)) {
                $flat = isset($heartbeats[0]) ? $heartbeats : array_merge(...array_values($heartbeats));
                if (!empty($flat)) {
                    $latest       = end($flat);
                    $latestStatus = is_array($latest) ? (int) ($latest['status'] ?? 1) : 1;
                }
            }

            $result = [
                'down'         => $latestStatus === 0,
                'monitor_name' => $name,
                'checked_at'   => now()->toIso8601String(),
            ];

            Cache::put(self::CACHE_KEY, $result, now()->addMinutes(self::CACHE_TTL_MINS));

            return $result;
        } catch (\Throwable $e) {
            Log::warning('SWC status API poll failed: ' . $e->getMessage());
            return $default;
        }
    }
}
