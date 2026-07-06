<?php

namespace App\Jobs;

use App\Models\DroidBrain\DroidBrainIndexStatus;
use App\Support\DroidBrain\DroidBrainBrowserService;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Bus\Queueable;

class DroidBrainReindexJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    // 2, not 1 — a deploy's hard worker restart can catch this job mid-run, orphaning
    // it as "reserved" in the queue. Once redelivered it would otherwise instantly
    // fail with MaxAttemptsExceededException before ever calling handle() again.
    // Reindexing is idempotent (just re-syncs the whole tab to Meilisearch), so a
    // real retry is safe.
    public int $tries = 2;
    public int $timeout = 3600;

    private const CHUNK_SIZE = 500;

    private static array $modelMap = [
        'ships'    => \App\Models\DroidBrain\DroidBrainShip::class,
        'stations' => \App\Models\DroidBrain\DroidBrainStation::class,
        'planets'  => \App\Models\DroidBrain\DroidBrainPlanet::class,
        'cities'   => \App\Models\DroidBrain\DroidBrainCity::class,
        'vehicles' => \App\Models\DroidBrain\DroidBrainVehicle::class,
        'npcs'     => \App\Models\DroidBrain\DroidBrainNpc::class,
    ];

    public function __construct(public readonly string $tab)
    {
        $this->onQueue('search-index');
    }

    // One unique job per tab — a second dispatch within the delay window replaces the first
    public function uniqueId(): string
    {
        return 'droidbrain-reindex-' . $this->tab;
    }

    public function handle(): void
    {
        $modelClass = self::$modelMap[$this->tab] ?? null;

        if (!$modelClass) {
            return;
        }

        $modelClass::chunk(self::CHUNK_SIZE, fn ($records) => $records->searchable());
        DroidBrainIndexStatus::markClean($this->tab);
        app(DroidBrainBrowserService::class)->warmOptionsCache($this->tab);
    }

    public static function dispatchForTab(string $tab): void
    {
        DroidBrainIndexStatus::markDirty($tab);
        static::dispatch($tab)->delay(now()->addMinutes(2));
    }
}
