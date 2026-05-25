<?php

namespace App\Console\Commands;

use App\Jobs\DroidBrainReindexJob;
use App\Models\DroidBrain\DroidBrainIndexStatus;
use Illuminate\Console\Command;

class DroidBrainReindexDirtyCommand extends Command
{
    protected $signature = 'droidbrain:reindex-dirty';
    protected $description = 'Dispatch reindex jobs for any DroidBrain tabs still marked dirty';

    public function handle(): void
    {
        $dirty = DroidBrainIndexStatus::where('is_dirty', true)->pluck('tab');

        if ($dirty->isEmpty()) {
            $this->line('No dirty tabs.');
            return;
        }

        foreach ($dirty as $tab) {
            DroidBrainReindexJob::dispatch($tab);
            $this->line("Dispatched reindex for: {$tab}");
        }

        $this->info('Done.');
    }
}
