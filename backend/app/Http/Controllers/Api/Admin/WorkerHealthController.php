<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorkerHealthController extends Controller
{
    public function show(): JsonResponse
    {
        $default = config('queue.default', 'sync');
        $connection = config("queue.connections.{$default}", []);
        $driver = (string) ($connection['driver'] ?? $default);

        $queue = $this->queueBacklogSummary($driver, $connection);
        $failedJobs = $this->failedJobsSummary();
        $droidBrain = $this->droidBrainQueueSummary();

        $status = 'ok';
        if ($queue['status'] === 'error' || $failedJobs['status'] === 'error' || $droidBrain['status'] === 'error') {
            $status = 'error';
        } elseif ($queue['status'] === 'warn' || $failedJobs['status'] === 'warn' || $droidBrain['status'] === 'warn') {
            $status = 'warn';
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'status' => $status,
                'generated_at' => now()->toIso8601String(),
                'queue' => $queue,
                'failed_jobs' => $failedJobs,
                'droidbrain_upload_queue' => $droidBrain,
            ],
        ]);
    }

    protected function queueBacklogSummary(string $driver, array $connection): array
    {
        $error = null;
        $totalPending = null;
        $totalReserved = null;
        $oldestPendingSeconds = null;
        $byQueue = [];

        try {
            if ($driver === 'database') {
                $jobsTable = (string) ($connection['table'] ?? 'queue_jobs');
                if (!Schema::hasTable($jobsTable)) {
                    throw new \RuntimeException("Queue jobs table '{$jobsTable}' does not exist.");
                }

                $rows = DB::table($jobsTable)
                    ->selectRaw(
                        'queue, COUNT(*) as pending_count, SUM(CASE WHEN reserved_at IS NOT NULL THEN 1 ELSE 0 END) as reserved_count, MIN(created_at) as oldest_created_at'
                    )
                    ->groupBy('queue')
                    ->orderByDesc('pending_count')
                    ->get();

                $nowUnix = now()->timestamp;
                $totalPending = 0;
                $totalReserved = 0;
                $oldestCreated = null;

                foreach ($rows as $row) {
                    $pendingCount = (int) $row->pending_count;
                    $reservedCount = (int) ($row->reserved_count ?? 0);
                    $oldestCreatedAt = $row->oldest_created_at ? (int) $row->oldest_created_at : null;
                    $oldestWaiting = $oldestCreatedAt ? max(0, $nowUnix - $oldestCreatedAt) : null;

                    $byQueue[] = [
                        'queue' => (string) $row->queue,
                        'pending' => $pendingCount,
                        'reserved' => $reservedCount,
                        'oldest_waiting_seconds' => $oldestWaiting,
                    ];

                    $totalPending += $pendingCount;
                    $totalReserved += $reservedCount;
                    if ($oldestCreatedAt !== null && ($oldestCreated === null || $oldestCreatedAt < $oldestCreated)) {
                        $oldestCreated = $oldestCreatedAt;
                    }
                }

                $oldestPendingSeconds = $oldestCreated !== null ? max(0, $nowUnix - $oldestCreated) : 0;
            }
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }

        $status = 'ok';
        if ($error !== null) {
            $status = 'error';
        } elseif ($driver !== 'database') {
            $status = 'warn';
        } elseif (($totalPending ?? 0) > 0 && ($oldestPendingSeconds ?? 0) >= 900) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'default_connection' => config('queue.default', 'sync'),
            'driver' => $driver,
            'pending_total' => $totalPending,
            'reserved_total' => $totalReserved,
            'oldest_pending_seconds' => $oldestPendingSeconds,
            'by_queue' => $byQueue,
            'error' => $error,
        ];
    }

    protected function failedJobsSummary(): array
    {
        $recentWindowHours = 24;
        $error = null;
        $total = null;
        $recent = null;
        $lastFailedAt = null;
        $latest = [];

        try {
            $failedTable = (string) config('queue.failed.table', 'failed_jobs');
            if (!Schema::hasTable($failedTable)) {
                throw new \RuntimeException("Failed jobs table '{$failedTable}' does not exist.");
            }

            $total = DB::table($failedTable)->count();
            $recent = DB::table($failedTable)
                ->where('failed_at', '>=', Carbon::now()->subHours($recentWindowHours))
                ->count();
            $lastFailedAt = DB::table($failedTable)->max('failed_at');

            $latestRows = DB::table($failedTable)
                ->orderByDesc('id')
                ->limit(20)
                ->get(['id', 'connection', 'queue', 'payload', 'exception', 'failed_at']);

            foreach ($latestRows as $row) {
                $latest[] = [
                    'id' => (int) $row->id,
                    'connection' => (string) $row->connection,
                    'queue' => (string) $row->queue,
                    'failed_at' => $row->failed_at ? Carbon::parse((string) $row->failed_at)->toIso8601String() : null,
                    'job_name' => $this->extractJobName((string) $row->payload),
                    'error_summary' => $this->extractExceptionSummary((string) $row->exception),
                ];
            }
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }

        $status = 'ok';
        if ($error !== null) {
            $status = 'error';
        } elseif (($recent ?? 0) > 0) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'total' => $total,
            'recent' => $recent,
            'recent_window_hours' => $recentWindowHours,
            'last_failed_at' => $lastFailedAt ? Carbon::parse((string) $lastFailedAt)->toIso8601String() : null,
            'latest' => $latest,
            'error' => $error,
        ];
    }

    protected function droidBrainQueueSummary(): array
    {
        $error = null;
        $counts = [];
        $recentFailed = [];

        try {
            if (!Schema::hasTable('droidbrain_upload_queue_items')) {
                return [
                    'status' => 'warn',
                    'counts' => [],
                    'recent_failed' => [],
                    'error' => 'droidbrain_upload_queue_items table is missing. Run migrations.',
                ];
            }

            $countRows = DB::table('droidbrain_upload_queue_items')
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->get();

            foreach ($countRows as $row) {
                $counts[(string) $row->status] = (int) $row->total;
            }

            $failedRows = DB::table('droidbrain_upload_queue_items')
                ->where('status', 'failed')
                ->orderByDesc('id')
                ->limit(20)
                ->get(['id', 'file_name', 'error_message', 'processed_at', 'updated_at']);

            foreach ($failedRows as $row) {
                $recentFailed[] = [
                    'id' => (int) $row->id,
                    'file_name' => (string) $row->file_name,
                    'error_message' => $row->error_message ? trim((string) $row->error_message) : null,
                    'processed_at' => $row->processed_at ? Carbon::parse((string) $row->processed_at)->toIso8601String() : null,
                    'updated_at' => $row->updated_at ? Carbon::parse((string) $row->updated_at)->toIso8601String() : null,
                ];
            }
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }

        $failedCount = (int) ($counts['failed'] ?? 0);
        $status = 'ok';
        if ($error !== null) {
            $status = 'error';
        } elseif ($failedCount > 0 || (int) ($counts['queued'] ?? 0) > 25) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'counts' => $counts,
            'recent_failed' => $recentFailed,
            'error' => $error,
        ];
    }

    protected function extractJobName(string $payload): string
    {
        $decoded = json_decode($payload, true);
        if (is_array($decoded)) {
            $display = trim((string) ($decoded['displayName'] ?? ''));
            if ($display !== '') {
                return $display;
            }

            $job = trim((string) ($decoded['job'] ?? ''));
            if ($job !== '') {
                return $job;
            }
        }

        return 'Unknown Job';
    }

    protected function extractExceptionSummary(string $exception): string
    {
        $firstLine = trim((string) strtok($exception, "\n"));
        if ($firstLine === '') {
            return 'No exception details captured.';
        }

        return substr($firstLine, 0, 300);
    }
}
