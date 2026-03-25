<?php

namespace App\Jobs;

use App\Models\SwcUniverseSyncRun;
use App\Support\Swc\UniversePersistenceService;
use App\Support\Swc\UniverseSyncCancelledException;
use App\Support\Swc\UniversePullService;
use Illuminate\Bus\Queueable;
use Illuminate\Database\QueryException;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

class RunUniverseFullSyncJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    protected const SECTOR_PULLS_PER_HOUR = 250;

    protected const SECTOR_PULL_LIMITER_KEY = 'sys:universe:sector-pulls';

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

        $options = $run->options ?? [];
        $progress = $run->progress ?? [];
        $stats = $run->stats ?? [];
        $liveStats = $stats;

        $run->forceFill([
            'status' => 'running',
            'started_at' => $run->started_at ?? now(),
            'next_retry_at' => null,
        ])->save();

        $this->writeHeartbeat($run->id, [
            'status' => 'running',
            'message' => 'Background universe sync started.',
            'stats' => $liveStats,
            'updated_at' => now()->toIso8601String(),
        ]);

        $this->guardCancelled($run);

        if (empty($progress['sector_identifiers'])) {
            $indexPayload = $universePullService->pullAllSectorsIndex();
            $indexPersistence = $universePersistenceService->persist($indexPayload);
            $sectors = array_values(array_filter((array) ($indexPayload['sectors'] ?? []), fn ($sector) => is_array($sector)));

            $progress['sector_identifiers'] = array_map(
                fn (array $sector): array => [
                    'uid' => $sector['uid'] ?? null,
                    'name' => $sector['name'] ?? null,
                    'identifier' => $sector['identifier'] ?? $sector['uid'] ?? $sector['name'] ?? null,
                ],
                $sectors
            );
            $progress['sector_cursor'] = 0;
            $progress['sector_total'] = count($progress['sector_identifiers']);

            $stats['sector_index_pages'] = $indexPersistence['pages'] ?? ($indexPayload['meta']['pages'] ?? null);
            $stats['sector_index_total'] = $indexPersistence['total'] ?? count($progress['sector_identifiers']);
            $stats['sector_index_seeded'] = $indexPersistence['sector_count'] ?? count($progress['sector_identifiers']);

            $run->forceFill([
                'progress' => $progress,
                'stats' => $stats,
                'last_message' => sprintf(
                    'Sector index loaded. %d sectors queued for hydration.',
                    $progress['sector_total'] ?? 0
                ),
            ])->save();
        }

        $sectorEntries = array_values(array_filter(
            (array) ($progress['sector_identifiers'] ?? []),
            fn ($entry) => is_array($entry) && !empty($entry['identifier'])
        ));

        $cursor = (int) ($progress['sector_cursor'] ?? 0);
        $total = count($sectorEntries);
        $deep = (bool) ($options['deep'] ?? true);

        for ($index = $cursor; $index < $total; $index += 1) {
            $run->refresh();
            $this->guardCancelled($run);

            $entry = $sectorEntries[$index];
            $retryAfter = $this->acquireSectorAllowance();

            if ($retryAfter !== null) {
                $progress['sector_cursor'] = $index;

                $run->forceFill([
                    'status' => 'waiting_rate_limit',
                    'progress' => $progress,
                    'stats' => $stats,
                    'last_message' => sprintf(
                        'Rate limit reached after %d/%d sector detail pulls. Resuming automatically.',
                        $index,
                        $total
                    ),
                    'next_retry_at' => now()->addSeconds($retryAfter + 5),
                ])->save();

                $this->writeHeartbeat($run->id, [
                    'status' => 'waiting_rate_limit',
                    'message' => sprintf(
                        'Rate limit reached after %d/%d sector detail pulls. Waiting to resume.',
                        $index,
                        $total
                    ),
                    'stats' => $liveStats,
                    'updated_at' => now()->toIso8601String(),
                ]);

                self::dispatch($run->id)
                    ->onConnection('database')
                    ->onQueue('swc-sync')
                    ->delay(now()->addSeconds($retryAfter + 5));

                return;
            }

            $progress['sector_cursor'] = $index;
            $progress['current_sector'] = [
                'index' => $index + 1,
                'total' => $total,
                'uid' => $entry['uid'] ?? null,
                'name' => $entry['name'] ?? null,
                'identifier' => $entry['identifier'] ?? null,
            ];

            $run->forceFill([
                'progress' => $progress,
                'last_message' => sprintf(
                    'Hydrating sector %d/%d: %s',
                    $index + 1,
                    $total,
                    $entry['name'] ?? $entry['uid'] ?? $entry['identifier'] ?? 'Unknown'
                ),
            ])->save();

            $this->writeHeartbeat($run->id, [
                'status' => 'running',
                'message' => sprintf(
                    'Hydrating sector %d/%d: %s',
                    $index + 1,
                    $total,
                    $entry['name'] ?? $entry['uid'] ?? $entry['identifier'] ?? 'Unknown'
                ),
                'stats' => $liveStats,
                'sector' => $progress['current_sector'],
                'updated_at' => now()->toIso8601String(),
            ]);

            $liveDetail = null;
            $lastStatsPersistAt = null;

            try {
                $detailPayload = $universePullService->pull('sector', (string) $entry['identifier']);
                $persistence = $universePersistenceService->persist(
                    $detailPayload,
                    $deep,
                    function (string $event, array $payload = []) use (&$liveDetail, &$liveStats, &$progress, &$lastStatsPersistAt, $index, $total, $run) {
                        $run->refresh();
                        $this->guardCancelled($run);

                        $liveStats = $this->applyLiveStatEvent($liveStats, $event);

                        $liveDetail = [
                            'event' => $event,
                            'payload' => $payload,
                            'message' => $this->formatProgressMessage($event, $payload),
                            'sector_index' => $index + 1,
                            'sector_total' => $total,
                            'updated_at' => now()->toIso8601String(),
                        ];

                        $this->writeHeartbeat($run->id, [
                            'status' => 'running',
                            'message' => $liveDetail['message'],
                            'stats' => $liveStats,
                            'detail' => $liveDetail,
                            'sector' => [
                                'index' => $index + 1,
                                'total' => $total,
                            ],
                            'updated_at' => $liveDetail['updated_at'],
                        ]);

                        $now = now();
                        $shouldPersistLiveStats = $lastStatsPersistAt === null
                            || $now->diffInSeconds($lastStatsPersistAt) >= 3
                            || in_array($event, ['system_pull_completed', 'planet_pull_completed', 'station_pull_completed'], true);

                        if ($shouldPersistLiveStats) {
                            $progress['last_detail'] = $liveDetail;

                            $run->forceFill([
                                'progress' => $progress,
                                'stats' => $liveStats,
                                'last_message' => $liveDetail['message'],
                            ])->save();

                            $lastStatsPersistAt = $now;
                        }
                    }
                );
            } catch (QueryException $exception) {
                if (!$this->isRetryableLockException($exception)) {
                    throw $exception;
                }

                $progress['sector_cursor'] = $index;
                $progress['last_detail'] = $liveDetail;
                $retryAfter = 20;

                $run->forceFill([
                    'status' => 'waiting_db_lock',
                    'progress' => $progress,
                    'stats' => $stats,
                    'last_message' => sprintf(
                        'Database lock while hydrating sector %d/%d: %s. Retrying automatically.',
                        $index + 1,
                        $total,
                        $entry['name'] ?? $entry['uid'] ?? $entry['identifier'] ?? 'Unknown'
                    ),
                    'error_message' => $exception->getMessage(),
                    'next_retry_at' => now()->addSeconds($retryAfter),
                ])->save();

                $this->writeHeartbeat($run->id, [
                    'status' => 'waiting_db_lock',
                    'message' => $exception->getMessage(),
                    'stats' => $liveStats,
                    'detail' => $liveDetail,
                    'sector' => $progress['current_sector'] ?? null,
                    'updated_at' => now()->toIso8601String(),
                ]);

                self::dispatch($run->id)
                    ->onConnection('database')
                    ->onQueue('swc-sync')
                    ->delay(now()->addSeconds($retryAfter));

                return;
            }

            $stats['sector_details_synced'] = (int) ($stats['sector_details_synced'] ?? 0) + 1;
            $stats['systems_upserted'] = (int) ($stats['systems_upserted'] ?? 0) + (int) ($persistence['systems_upserted'] ?? 0);
            $stats['systems_deep_synced'] = (int) ($stats['systems_deep_synced'] ?? 0) + (int) ($persistence['systems_deep_synced'] ?? 0);
            $stats['planets_upserted'] = (int) ($stats['planets_upserted'] ?? 0) + (int) ($persistence['planets_upserted'] ?? 0);
            $stats['stations_upserted'] = (int) ($stats['stations_upserted'] ?? 0) + (int) ($persistence['stations_upserted'] ?? 0);
            $stats['hyperlanes_upserted'] = (int) ($stats['hyperlanes_upserted'] ?? 0) + (int) ($persistence['hyperlanes_upserted'] ?? 0);
            $stats['planets_deep_synced'] = (int) ($stats['planets_deep_synced'] ?? 0) + (int) ($persistence['planets_deep_synced'] ?? 0);
            $stats['stations_deep_synced'] = (int) ($stats['stations_deep_synced'] ?? 0) + (int) ($persistence['stations_deep_synced'] ?? 0);
            $stats['destination_systems_synced'] = (int) ($stats['destination_systems_synced'] ?? 0) + (int) ($persistence['destination_systems_synced'] ?? 0);
            $liveStats = $stats;

            $progress['sector_cursor'] = $index + 1;
            $progress['last_detail'] = $liveDetail;

            $run->forceFill([
                'progress' => $progress,
                'stats' => $stats,
                'last_message' => sprintf(
                    'Completed sector %d/%d: %s',
                    $index + 1,
                    $total,
                    $entry['name'] ?? $entry['uid'] ?? $entry['identifier'] ?? 'Unknown'
                ),
            ])->save();

            $this->writeHeartbeat($run->id, [
                'status' => 'running',
                'message' => sprintf(
                    'Completed sector %d/%d: %s',
                    $index + 1,
                    $total,
                    $entry['name'] ?? $entry['uid'] ?? $entry['identifier'] ?? 'Unknown'
                ),
                'stats' => $liveStats,
                'detail' => $liveDetail,
                'sector' => $progress['current_sector'],
                'updated_at' => now()->toIso8601String(),
            ]);
        }

        $run->forceFill([
            'status' => 'completed',
            'progress' => $progress,
            'stats' => $stats,
            'last_message' => 'Full universe sync completed.',
            'finished_at' => now(),
            'next_retry_at' => null,
        ])->save();

        $this->writeHeartbeat($run->id, [
            'status' => 'completed',
            'message' => 'Full universe sync completed.',
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
                'last_message' => 'Full universe sync cancelled.',
                'finished_at' => now(),
                'next_retry_at' => null,
            ]);

            try {
                $run->save();
            } catch (\Throwable) {
            }

            $this->writeHeartbeat($this->syncRunId, [
                'status' => 'cancelled',
                'message' => 'Full universe sync cancelled.',
                'stats' => $run->stats ?? [],
                'updated_at' => now()->toIso8601String(),
            ]);

            return;
        }

        $run->forceFill([
            'status' => 'failed',
            'error_message' => $exception->getMessage(),
            'last_message' => 'Full universe sync failed.',
            'finished_at' => now(),
            'next_retry_at' => null,
        ]);

        try {
            $run->save();
        } catch (\Throwable) {
            // Best-effort status update only. The original queue error is more important.
        }

        $this->writeHeartbeat($this->syncRunId, [
            'status' => 'failed',
            'message' => $exception->getMessage(),
            'stats' => $run->stats ?? [],
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    protected function acquireSectorAllowance(): ?int
    {
        if (RateLimiter::tooManyAttempts(self::SECTOR_PULL_LIMITER_KEY, self::SECTOR_PULLS_PER_HOUR)) {
            return RateLimiter::availableIn(self::SECTOR_PULL_LIMITER_KEY);
        }

        RateLimiter::hit(self::SECTOR_PULL_LIMITER_KEY, 3600);

        return null;
    }

    protected function formatProgressMessage(string $event, array $payload): string
    {
        return match ($event) {
            'sector_saved' => 'Saved sector shell.',
            'system_upserted' => sprintf(
                'Indexed system %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'system_pull_started' => sprintf(
                'Pulling full system %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'system_pull_completed' => sprintf(
                'Completed full system %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'system_pull_skipped' => sprintf(
                'Skipped system %s: %s',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown',
                $payload['reason'] ?? 'Unavailable in SWC.'
            ),
            'planet_pull_started' => sprintf(
                'Pulling planet %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'planet_pull_completed' => sprintf(
                'Completed planet %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'planet_pull_skipped' => sprintf(
                'Skipped planet %s: %s',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown',
                $payload['reason'] ?? 'Unavailable in SWC.'
            ),
            'station_pull_started' => sprintf(
                'Pulling station %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'station_pull_completed' => sprintf(
                'Completed station %s.',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown'
            ),
            'station_pull_skipped' => sprintf(
                'Skipped station %s: %s',
                $payload['name'] ?? $payload['uid'] ?? $payload['identifier'] ?? 'Unknown',
                $payload['reason'] ?? 'Unavailable in SWC.'
            ),
            'destination_system_pull_started' => sprintf(
                'Pulling connected system %s.',
                $payload['destination_name'] ?? $payload['destination_uid'] ?? 'Unknown'
            ),
            'destination_system_pull_completed' => sprintf(
                'Completed connected system %s.',
                $payload['destination_name'] ?? $payload['destination_uid'] ?? 'Unknown'
            ),
            default => 'Processing universe sync...',
        };
    }

    protected function writeHeartbeat(int $runId, array $payload): void
    {
        Cache::put(
            $this->heartbeatCacheKey($runId),
            $payload,
            now()->addHours(12)
        );
    }

    protected function guardCancelled(SwcUniverseSyncRun $run): void
    {
        if ($run->status !== 'cancel_requested') {
            return;
        }

        $this->writeHeartbeat($run->id, [
            'status' => 'cancel_requested',
            'message' => 'Cancellation requested. Stopping background universe sync.',
            'stats' => $run->stats ?? [],
            'updated_at' => now()->toIso8601String(),
        ]);

        throw new UniverseSyncCancelledException('Background universe sync cancelled by user.');
    }

    protected function heartbeatCacheKey(int $runId): string
    {
        return sprintf('swc:universe-sync-run:%d:heartbeat', $runId);
    }

    protected function isRetryableLockException(QueryException $exception): bool
    {
        $message = $exception->getMessage();

        return str_contains($message, 'Lock wait timeout exceeded')
            || str_contains($message, 'Deadlock found when trying to get lock');
    }

    protected function applyLiveStatEvent(array $stats, string $event): array
    {
        return match ($event) {
            'sector_saved' => $this->incrementStat($stats, 'sector_details_synced'),
            'system_pull_completed' => $this->incrementStat($stats, 'systems_deep_synced'),
            'planet_pull_completed' => $this->incrementStat($stats, 'planets_deep_synced'),
            'station_pull_completed' => $this->incrementStat($stats, 'stations_deep_synced'),
            'hyperlane_upserted' => $this->incrementStat($stats, 'hyperlanes_upserted'),
            'destination_system_pull_completed' => $this->incrementStat($stats, 'destination_systems_synced'),
            default => $stats,
        };
    }

    protected function incrementStat(array $stats, string $key): array
    {
        $stats[$key] = (int) ($stats[$key] ?? 0) + 1;

        return $stats;
    }
}
