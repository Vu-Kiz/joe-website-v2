<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessAllPendingPaymentsJob;
use App\Jobs\ProcessDroidBrainUploadJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $droidBrainPayment = $this->droidBrainPaymentSummary();

        $status = 'ok';
        $sections = [$queue, $failedJobs, $droidBrain, $droidBrainPayment];
        foreach ($sections as $section) {
            if (($section['status'] ?? 'ok') === 'error') { $status = 'error'; break; }
        }
        if ($status !== 'error') {
            foreach ($sections as $section) {
                if (($section['status'] ?? 'ok') === 'warn') { $status = 'warn'; break; }
            }
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'status' => $status,
                'generated_at' => now()->toIso8601String(),
                'queue' => $queue,
                'failed_jobs' => $failedJobs,
                'droidbrain_upload_queue' => $droidBrain,
                'droidbrain_payment_queue' => $droidBrainPayment,
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

                // Warn threshold (seconds) per named queue. Queues not listed use the default.
                $warnThresholds = [
                    'xml-imports'       => 7200,  // 2h — large XML files, slow but expected
                    'swc-sync'          => 14400, // 4h — monthly bulk ingest, can be slow
                    'search-index'      => 1800,  // 30m
                    'payment-reconcile' => 1800,  // 30m
                    'default'           => 1800,  // 30m
                ];
                $defaultThreshold = 1800;

                foreach ($rows as $row) {
                    $pendingCount = (int) $row->pending_count;
                    $reservedCount = (int) ($row->reserved_count ?? 0);
                    $oldestCreatedAt = $row->oldest_created_at ? (int) $row->oldest_created_at : null;
                    $oldestWaiting = $oldestCreatedAt ? max(0, $nowUnix - $oldestCreatedAt) : null;
                    $queueName = (string) $row->queue;
                    $threshold = $warnThresholds[$queueName] ?? $defaultThreshold;
                    $queueStatus = 'ok';
                    if ($pendingCount > 0 && $oldestWaiting !== null && $oldestWaiting >= $threshold) {
                        $queueStatus = 'warn';
                    }

                    $byQueue[] = [
                        'queue' => $queueName,
                        'pending' => $pendingCount,
                        'reserved' => $reservedCount,
                        'oldest_waiting_seconds' => $oldestWaiting,
                        'warn_threshold_seconds' => $threshold,
                        'status' => $queueStatus,
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
        } elseif (collect($byQueue)->contains('status', 'warn')) {
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

            $stuckCount = DB::table('droidbrain_upload_queue_items')
                ->where('status', 'processing')
                ->where('updated_at', '<', now()->subHours(2)->toDateTimeString())
                ->count();

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
        $stuckCount = $stuckCount ?? 0;
        $status = 'ok';
        if ($error !== null) {
            $status = 'error';
        } elseif ($failedCount > 0 || $stuckCount > 0 || (int) ($counts['queued'] ?? 0) > 25) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'counts' => $counts,
            'stuck_count' => $stuckCount,
            'recent_failed' => $recentFailed,
            'error' => $error,
        ];
    }

    protected function droidBrainPaymentSummary(): array
    {
        $error = null;
        $counts = [];
        $recentFailed = [];
        $stuckCount = 0;

        try {
            if (!Schema::hasTable('droidbrain_files')) {
                return [
                    'status' => 'warn',
                    'counts' => [],
                    'stuck_count' => 0,
                    'recent_failed' => [],
                    'error' => 'droidbrain_files table is missing.',
                ];
            }

            if (!Schema::hasColumn('droidbrain_files', 'payment_status')) {
                return [
                    'status' => 'warn',
                    'counts' => [],
                    'stuck_count' => 0,
                    'recent_failed' => [],
                    'error' => 'payment_status column missing — run migrations.',
                ];
            }

            $countRows = DB::table('droidbrain_files')
                ->selectRaw('payment_status, COUNT(*) as total')
                ->groupBy('payment_status')
                ->get();

            foreach ($countRows as $row) {
                $counts[(string) $row->payment_status] = (int) $row->total;
            }

            // Payments run daily at 3am. Flag anything still pending after 25 hours
            // as the daily job likely failed to run.
            $stuckCount = DB::table('droidbrain_files')
                ->where('payment_status', 'pending')
                ->where('updated_at', '<', now()->subHours(25)->toDateTimeString())
                ->count();

            $failedRows = DB::table('droidbrain_files')
                ->where('payment_status', 'failed')
                ->orderByDesc('id')
                ->limit(20)
                ->get(['id', 'file_name', 'payment_status', 'updated_at']);

            foreach ($failedRows as $row) {
                $recentFailed[] = [
                    'id' => (int) $row->id,
                    'file_name' => (string) $row->file_name,
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
        } elseif ($failedCount > 0 || $stuckCount > 0) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'counts' => $counts,
            'stuck_count' => $stuckCount,
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

    public function recoverStuckImports(): JsonResponse
    {
        $stuck = DB::table('droidbrain_upload_queue_items')
            ->where('status', 'processing')
            ->where('updated_at', '<', now()->subHours(2)->toDateTimeString())
            ->get(['id', 'file_name']);

        foreach ($stuck as $item) {
            DB::table('droidbrain_upload_queue_items')
                ->where('id', $item->id)
                ->update(['status' => 'queued', 'error_message' => null, 'updated_at' => now()]);

            ProcessDroidBrainUploadJob::dispatch((int) $item->id);
        }

        return response()->json(['ok' => true, 'dispatched' => $stuck->count()]);
    }

    public function runPaymentsNow(): JsonResponse
    {
        // Clear the unique job lock so it always dispatches even if a previous run stalled
        $lockKey = 'laravel_unique_job:' . ProcessAllPendingPaymentsJob::class;
        \Illuminate\Support\Facades\Cache::forget($lockKey);

        ProcessAllPendingPaymentsJob::dispatch();

        return response()->json(['ok' => true]);
    }

    public function retryFailedPayments(): JsonResponse
    {
        $updated = DB::table('droidbrain_files')
            ->where('payment_status', 'failed')
            ->update(['payment_status' => 'pending', 'updated_at' => now()]);

        return response()->json(['ok' => true, 'reset' => $updated]);
    }

    public function retryImport(Request $request, int $id): JsonResponse
    {
        $item = DB::table('droidbrain_upload_queue_items')->where('id', $id)->first();

        if (!$item) {
            return response()->json(['ok' => false, 'message' => 'Queue item not found.'], 404);
        }

        if ($item->status === 'completed') {
            return response()->json(['ok' => false, 'message' => 'Item already completed.'], 422);
        }

        DB::table('droidbrain_upload_queue_items')
            ->where('id', $id)
            ->update(['status' => 'queued', 'error_message' => null, 'updated_at' => now()]);

        ProcessDroidBrainUploadJob::dispatch($id);

        return response()->json(['ok' => true]);
    }

    public function clearFailedJobs(): JsonResponse
    {
        $failedTable = (string) config('queue.failed.table', 'failed_jobs');
        $count = DB::table($failedTable)->count();
        DB::table($failedTable)->truncate();

        return response()->json(['ok' => true, 'cleared' => $count]);
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
