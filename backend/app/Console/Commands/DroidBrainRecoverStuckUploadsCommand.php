<?php

namespace App\Console\Commands;

use App\Jobs\ProcessDroidBrainUploadJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DroidBrainRecoverStuckUploadsCommand extends Command
{
    protected $signature = 'droidbrain:recover-stuck-uploads';
    protected $description = 'Re-dispatch upload queue items stuck in processing for more than 2 hours';

    public function handle(): void
    {
        $stuck = DB::table('droidbrain_upload_queue_items')
            ->where('status', 'processing')
            ->where('updated_at', '<', now()->subHours(2)->toDateTimeString())
            ->get(['id', 'file_name', 'updated_at']);

        if ($stuck->isEmpty()) {
            $this->line('No stuck imports found.');
            return;
        }

        foreach ($stuck as $item) {
            ProcessDroidBrainUploadJob::dispatch((int) $item->id);
            $this->line("Re-dispatched import #{$item->id} ({$item->file_name}), stuck since {$item->updated_at}");
        }

        $this->info("Re-dispatched {$stuck->count()} stuck import(s).");
    }
}
