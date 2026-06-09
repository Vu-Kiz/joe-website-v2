<?php

namespace App\Jobs;

use App\Models\Swc\SwcPlanet;
use App\Models\Swc\SwcSector;
use App\Models\Swc\SwcSystem;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class UniverseReindexJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;
    public int $timeout = 3600;

    private const CHUNK_SIZE = 500;

    private static array $modelMap = [
        'systems' => SwcSystem::class,
        'planets' => SwcPlanet::class,
        'sectors' => SwcSector::class,
    ];

    public function __construct(public readonly string $tab)
    {
        $this->onQueue('search-index');
    }

    public function uniqueId(): string
    {
        return 'universe-reindex-' . $this->tab;
    }

    public function handle(): void
    {
        $modelClass = self::$modelMap[$this->tab] ?? null;

        if (!$modelClass) {
            return;
        }

        $modelClass::chunk(self::CHUNK_SIZE, fn ($records) => $records->searchable());
    }

    public static function dispatchForTab(string $tab): void
    {
        static::dispatch($tab)->delay(now()->addMinutes(2));
    }

    public static function dispatchAll(): void
    {
        foreach (array_keys(self::$modelMap) as $tab) {
            static::dispatchForTab($tab);
        }
    }
}
