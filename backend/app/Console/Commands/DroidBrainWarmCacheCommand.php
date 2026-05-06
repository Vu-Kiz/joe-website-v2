<?php

namespace App\Console\Commands;

use App\Support\DroidBrain\DroidBrainBrowserService;
use Illuminate\Console\Command;

class DroidBrainWarmCacheCommand extends Command
{
    protected $signature = 'droidbrain:warm-cache';
    protected $description = 'Pre-warm DroidBrain options cache for all tabs';

    public function handle(DroidBrainBrowserService $service): void
    {
        foreach (['ships', 'stations', 'planets', 'cities', 'vehicles', 'npcs'] as $tab) {
            $this->line("Warming {$tab}...");
            $service->warmOptionsCache($tab);
        }

        $this->info('Done.');
    }
}
