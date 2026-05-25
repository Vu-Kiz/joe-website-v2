<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Discord\DiscordBotGuild;
use App\Models\Discord\DiscordOutboxMessage;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WebsiteHealthController extends Controller
{
    public function show(): JsonResponse
    {
        $databaseStatus = 'ok';
        $databaseError = null;
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}", []);

        try {
            DB::select('SELECT 1');
        } catch (\Throwable $e) {
            $databaseStatus = 'error';
            $databaseError = $e->getMessage();
        }

        $queue = $this->queueSummary();

        return response()->json([
            'ok' => true,
            'data' => [
                'app' => [
                    'name' => config('app.name'),
                    'env' => config('app.env'),
                    'version' => config('app.version', '0.1.0'),
                    'app_url' => config('app.url'),
                    'timezone' => config('app.timezone'),
                    'php' => PHP_VERSION,
                    'laravel' => app()->version(),
                    'now' => now()->toIso8601String(),
                ],
                'database' => [
                    'status' => $databaseStatus,
                    'driver' => $driver,
                    'host' => $connection['host'] ?? null,
                    'database' => $connection['database'] ?? null,
                    'error' => $databaseError,
                ],
                'queue' => $queue,
                'discord_bot' => $this->discordBotSummary(),
                'storage' => [
                    'app_storage_writable' => is_writable(storage_path()),
                    'framework_writable' => is_writable(storage_path('framework')),
                    'cache_writable' => is_writable(storage_path('framework/cache')),
                    'bootstrap_cache_writable' => is_writable(base_path('bootstrap/cache')),
                ],
            ],
        ]);
    }

    protected function queueSummary(): array
    {
        $default = config('queue.default', 'sync');
        $connection = config("queue.connections.{$default}", []);
        $driver = (string) ($connection['driver'] ?? $default);
        $recentFailureWindowHours = 24;

        $pendingJobs = null;
        $failedJobs = null;
        $recentFailedJobs = null;
        $lastFailedAt = null;
        $queueError = null;

        try {
            if ($driver === 'database') {
                $jobsTable = (string) ($connection['table'] ?? 'jobs');
                if (Schema::hasTable($jobsTable)) {
                    $pendingJobs = DB::table($jobsTable)->count();
                }
            }

            $failedTable = (string) config('queue.failed.table', 'failed_jobs');
            if (Schema::hasTable($failedTable)) {
                $failedJobs = DB::table($failedTable)->count();
                if (Schema::hasColumn($failedTable, 'failed_at')) {
                    $recentFailedJobs = DB::table($failedTable)
                        ->where('failed_at', '>=', Carbon::now()->subHours($recentFailureWindowHours))
                        ->count();
                    $lastFailedAt = DB::table($failedTable)->max('failed_at');
                }
            }
        } catch (\Throwable $e) {
            $queueError = $e->getMessage();
        }

        $status = 'ok';
        if ($queueError !== null) {
            $status = 'error';
        } elseif (($recentFailedJobs ?? 0) > 0) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'default_connection' => $default,
            'driver' => $driver,
            'pending_jobs' => $pendingJobs,
            'failed_jobs' => $failedJobs,
            'recent_failed_jobs' => $recentFailedJobs,
            'recent_failure_window_hours' => $recentFailureWindowHours,
            'last_failed_at' => $lastFailedAt,
            'error' => $queueError,
        ];
    }

    protected function discordBotSummary(): array
    {
        $clientId = trim((string) config('services.discord_bot.client_id', ''));

        try {
            $knownGuilds = DiscordBotGuild::query()->count();
            $availableGuilds = DiscordBotGuild::query()->where('available', true)->count();
            $lastSeenGuild = DiscordBotGuild::query()
                ->whereNotNull('last_seen_at')
                ->orderByDesc('last_seen_at')
                ->first(['guild_name', 'guild_id', 'last_seen_at']);

            $pending = DiscordOutboxMessage::query()
                ->where('status', DiscordOutboxMessage::STATUS_PENDING)
                ->count();
            $processing = DiscordOutboxMessage::query()
                ->where('status', DiscordOutboxMessage::STATUS_PROCESSING)
                ->count();
            $failed = DiscordOutboxMessage::query()
                ->where('status', DiscordOutboxMessage::STATUS_FAILED)
                ->count();
            $sent = DiscordOutboxMessage::query()
                ->where('status', DiscordOutboxMessage::STATUS_SENT)
                ->count();
        } catch (\Throwable $e) {
            return [
                'status' => 'error',
                'configured' => $clientId !== '',
                'known_guilds' => null,
                'available_guilds' => null,
                'last_seen_guild' => null,
                'outbox_pending' => null,
                'outbox_processing' => null,
                'outbox_failed' => null,
                'outbox_sent' => null,
                'error' => $e->getMessage(),
            ];
        }

        $status = 'ok';
        if ($clientId === '' || $availableGuilds === 0) {
            $status = 'warn';
        }
        if ($failed > 0) {
            $status = 'warn';
        }

        return [
            'status' => $status,
            'configured' => $clientId !== '',
            'known_guilds' => $knownGuilds,
            'available_guilds' => $availableGuilds,
            'last_seen_guild' => $lastSeenGuild ? [
                'guild_name' => $lastSeenGuild->guild_name,
                'guild_id' => $lastSeenGuild->guild_id,
                'last_seen_at' => optional($lastSeenGuild->last_seen_at)->toIso8601String(),
            ] : null,
            'outbox_pending' => $pending,
            'outbox_processing' => $processing,
            'outbox_failed' => $failed,
            'outbox_sent' => $sent,
            'error' => null,
        ];
    }
}
