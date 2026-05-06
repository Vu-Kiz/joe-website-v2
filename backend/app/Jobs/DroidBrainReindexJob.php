<?php

namespace App\Jobs;

use App\Models\DroidBrainIndexStatus;
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
        'ships'    => \App\Models\DroidBrainShip::class,
        'stations' => \App\Models\DroidBrainStation::class,
        'planets'  => \App\Models\DroidBrainPlanet::class,
        'cities'   => \App\Models\DroidBrainCity::class,
        'vehicles' => \App\Models\DroidBrainVehicle::class,
        'npcs'     => \App\Models\DroidBrainNpc::class,
    ];

    public function __construct(public readonly string $tab) {}

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
