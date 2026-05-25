<?php

namespace App\Jobs;

use App\Models\Swc\SwcSystem;
use App\Models\Swc\SwcUniverseSyncRun;
use App\Support\Swc\UniversePersistenceService;
use App\Support\Swc\UniversePullService;
use App\Support\Swc\UniverseSyncCancelledException;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class RunStoredSystemRefreshJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(
        public int $syncRunId
    ) {
        $this->onConnection('database');
        $this->onQueue('swc-sync');
    }

    public function handle(
        UniversePullService $universePullService,
        UniversePersistenceService $universePersistenceService
    ): void {
        $run = SwcUniverseSyncRun::query()->find($this->syncRunId);

        if (!$run || in_array($run->status, ['completed', 'failed', 'cancelled', 'cancel_requested'], true)) {
            return;
        }

        $progress = $run->progress ?? [];
        $stats = $run->stats ?? [];

        $run->forceFill([
            'status' => 'running',
            'started_at' => $run->started_at ?? now(),
            'next_retry_at' => null,
        ])->save();

        if (!isset($progress['total'])) {
            $progress['total'] = SwcSystem::query()->count();
        }

        $progress['processed'] = (int) ($progress['processed'] ?? 0);
        $progress['last_system_id'] = (int) ($progress['last_system_id'] ?? 0);

        $stats['system_count'] = (int) ($stats['system_count'] ?? $progress['total'] ?? 0);
        $stats['refreshed_systems'] = (int) ($stats['refreshed_systems'] ?? 0);
        $stats['skipped_missing_identifier'] = (int) ($stats['skipped_missing_identifier'] ?? 0);
        $stats['skipped_not_found'] = (int) ($stats['skipped_not_found'] ?? 0);

        $run->forceFill([
            'progress' => $progress,
            'stats' => $stats,
            'last_message' => 'Background stored-system refresh started.',
        ])->save();

        $this->writeHeartbeat($run->id, [
            'status' => 'running',
            'message' => 'Background stored-system refresh started.',
            'stats' => $stats,
            'updated_at' => now()->toIso8601String(),
        ]);

        $lastStatsPersistAt = null;

        SwcSystem::query()
            ->where('id', '>', (int) ($progress['last_system_id'] ?? 0))
            ->orderBy('id')
            ->chunkById(100, function ($systems) use (
                &$progress,
                &$stats,
                &$lastStatsPersistAt,
                $run,
                $universePullService,
                $universePersistenceService
            ) {
                foreach ($systems as $system) {
                    $run->refresh();
                    $this->guardCancelled($run);

                    $progress['processed'] = (int) ($progress['processed'] ?? 0) + 1;
                    $progress['last_system_id'] = (int) $system->id;
                    $progress['current_system'] = [
                        'id' => $system->id,
                        'index' => $progress['processed'],
                        'total' => (int) ($progress['total'] ?? 0),
                        'uid' => $system->uid,
                        'name' => $system->name,
                        'identifier' => $system->identifier,
                    ];

                    $activeLabel = $system->name ?? $system->uid ?? $system->identifier ?? 'Unknown';
                    $activeMessage = sprintf(
                        'Refreshing system %d/%d: %s',
                        $progress['processed'],
                        (int) ($progress['total'] ?? 0),
                        $activeLabel
                    );

                    $run->forceFill([
                        'progress' => $progress,
                        'last_message' => $activeMessage,
                    ])->save();

                    $this->writeHeartbeat($run->id, [
                        'status' => 'running',
                        'message' => $activeMessage,
                        'stats' => $stats,
                        'system' => $progress['current_system'],
                        'updated_at' => now()->toIso8601String(),
                    ]);

                    $identifiers = $this->systemRefreshIdentifiers($system);

                    if ($identifiers === []) {
                        $stats['skipped_missing_identifier'] = (int) ($stats['skipped_missing_identifier'] ?? 0) + 1;
                        $progress['last_detail'] = [
                            'event' => 'system_skipped',
                            'message' => sprintf('Skipped %s: missing identifier.', $activeLabel),
                            'reason' => 'missing_identifier',
                            'updated_at' => now()->toIso8601String(),
                        ];

                        $this->persistLiveState($run, $progress, $stats, $progress['last_detail']['message']);
                        continue;
                    }

                    try {
                        $payload = $this->refreshSystemPayload($universePullService, $identifiers);
                        $persistence = $universePersistenceService->persist($payload, true);

                        $stats['refreshed_systems'] = (int) ($stats['refreshed_systems'] ?? 0) + 1;
                        $progress['last_detail'] = [
                            'event' => 'system_refresh_completed',
                            'message' => sprintf(
                                'Completed %d/%d: %s',
                                $progress['processed'],
                                (int) ($progress['total'] ?? 0),
                                $activeLabel
                            ),
                            'persistence' => $persistence,
                            'updated_at' => now()->toIso8601String(),
                        ];
                    } catch (QueryException $exception) {
                        if (!$this->isRetryableLockException($exception)) {
                            throw $exception;
                        }

                        $retryAfter = 20;

                        $run->forceFill([
                            'status' => 'waiting_db_lock',
                            'progress' => $progress,
                            'stats' => $stats,
                            'last_message' => sprintf(
                                'Database lock while refreshing system %s. Retrying automatically.',
                                $activeLabel
                            ),
                            'error_message' => $exception->getMessage(),
                            'next_retry_at' => now()->addSeconds($retryAfter),
                        ])->save();

                        $this->writeHeartbeat($run->id, [
                            'status' => 'waiting_db_lock',
                            'message' => $exception->getMessage(),
                            'stats' => $stats,
                            'system' => $progress['current_system'],
                            'updated_at' => now()->toIso8601String(),
                        ]);

                        self::dispatch($run->id)
                            ->onConnection('database')
                            ->onQueue('swc-sync')
                            ->delay(now()->addSeconds($retryAfter));

                        return false;
                    } catch (\Throwable $exception) {
                        if ($this->isSkippableSwcNotFoundException($exception)) {
                            $stats['skipped_not_found'] = (int) ($stats['skipped_not_found'] ?? 0) + 1;
                            $progress['last_detail'] = [
                                'event' => 'system_skipped',
                                'message' => sprintf('Skipped %s: not found in SWC.', $activeLabel),
                                'reason' => 'not_found',
                                'updated_at' => now()->toIso8601String(),
                            ];
                        } else {
                            throw $exception;
                        }
                    }

                    $now = now();
                    $shouldPersistLiveStats = $lastStatsPersistAt === null
                        || $now->diffInSeconds($lastStatsPersistAt) >= 3;

                    if ($shouldPersistLiveStats) {
                        $this->persistLiveState(
                            $run,
                            $progress,
                            $stats,
                            $progress['last_detail']['message'] ?? $activeMessage
                        );
                        $lastStatsPersistAt = $now;
                    }
                }
            });

        $run->forceFill([
            'status' => 'completed',
            'progress' => $progress,
            'stats' => $stats,
            'last_message' => 'Stored systems refresh completed.',
            'finished_at' => now(),
            'next_retry_at' => null,
            'error_message' => null,
        ])->save();

        $this->writeHeartbeat($run->id, [
            'status' => 'completed',
            'message' => 'Stored systems refresh completed.',
            'stats' => $stats,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        $run = SwcUniverseSyncRun::query()->find($this->syncRunId);

        if (!$run) {
            return;
        }

        if ($exception instanceof UniverseSyncCancelledException) {
            $run->forceFill([
                'status' => 'cancelled',
                'error_message' => null,
                'last_message' => 'Stored systems refresh cancelled.',
                'finished_at' => now(),
                'next_retry_at' => null,
            ]);

            try {
                $run->save();
            } catch (\Throwable) {
            }

            $this->writeHeartbeat($this->syncRunId, [
                'status' => 'cancelled',
                'message' => 'Stored systems refresh cancelled.',
                'stats' => $run->stats ?? [],
                'updated_at' => now()->toIso8601String(),
            ]);

            return;
        }

        $run->forceFill([
            'status' => 'failed',
            'error_message' => $exception->getMessage(),
            'last_message' => 'Stored systems refresh failed.',
            'finished_at' => now(),
            'next_retry_at' => null,
        ]);

        try {
            $run->save();
        } catch (\Throwable) {
        }

        $this->writeHeartbeat($this->syncRunId, [
            'status' => 'failed',
            'message' => $exception->getMessage(),
            'stats' => $run->stats ?? [],
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    protected function persistLiveState(SwcUniverseSyncRun $run, array $progress, array $stats, string $message): void
    {
        $run->forceFill([
            'progress' => $progress,
            'stats' => $stats,
            'last_message' => $message,
            'error_message' => null,
        ])->save();

        $this->writeHeartbeat($run->id, [
            'status' => 'running',
            'message' => $message,
            'stats' => $stats,
            'system' => $progress['current_system'] ?? null,
            'detail' => $progress['last_detail'] ?? null,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * @return list<string>
     */
    protected function systemRefreshIdentifiers(SwcSystem $system): array
    {
        $candidates = [
            trim((string) ($system->identifier ?? '')),
            trim((string) ($system->uid ?? '')),
            trim((string) ($system->name ?? '')),
        ];

        return array_values(array_unique(array_filter($candidates, fn ($value) => $value !== '')));
    }

    /**
     * @param list<string> $identifiers
     * @return array<string, mixed>
     */
    protected function refreshSystemPayload(UniversePullService $universePullService, array $identifiers): array
    {
        $lastException = null;

        foreach ($identifiers as $identifier) {
            try {
                return $universePullService->pull('system', $identifier);
            } catch (\Throwable $exception) {
                $lastException = $exception;
            }
        }

        if ($lastException instanceof \Throwable) {
            throw $lastException;
        }

        throw new \RuntimeException('No valid system identifiers were available for refresh.');
    }

    protected function isSkippableSwcNotFoundException(\Throwable $exception): bool
    {
        return str_contains($exception->getMessage(), 'SWC request failed with status 404');
    }

    protected function writeHeartbeat(int $runId, array $payload): void
    {
        Cache::put(
            $this->heartbeatCacheKey($runId),
            $payload,
            now()->addHours(12)
        );
    }

    protected function heartbeatCacheKey(int $runId): string
    {
        return sprintf('swc:universe-sync-run:%d:heartbeat', $runId);
    }

    protected function guardCancelled(SwcUniverseSyncRun $run): void
    {
        if ($run->status !== 'cancel_requested') {
            return;
        }

        $this->writeHeartbeat($run->id, [
            'status' => 'cancel_requested',
            'message' => 'Cancellation requested. Stopping stored-systems refresh.',
            'stats' => $run->stats ?? [],
            'updated_at' => now()->toIso8601String(),
        ]);

        throw new UniverseSyncCancelledException('Stored systems refresh cancelled by user.');
    }

    protected function isRetryableLockException(QueryException $exception): bool
    {
        $message = $exception->getMessage();

        return str_contains($message, 'Lock wait timeout exceeded')
            || str_contains($message, 'Deadlock found when trying to get lock');
    }
}
