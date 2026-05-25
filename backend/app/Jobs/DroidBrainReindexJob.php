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

    public int $tries = 1;
    public int $timeout = 300;

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

        $modelClass::makeAllSearchable();
        DroidBrainIndexStatus::markClean($this->tab);
        app(DroidBrainBrowserService::class)->warmOptionsCache($this->tab);
    }

    public static function dispatchForTab(string $tab): void
    {
        DroidBrainIndexStatus::markDirty($tab);
        static::dispatch($tab)->delay(now()->addMinutes(2));
    }
}
