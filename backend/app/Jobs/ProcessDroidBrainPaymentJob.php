<?php

namespace App\Jobs;

use App\Support\DroidBrain\DroidBrainRewardService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class ProcessDroidBrainPaymentJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(public readonly int $fileId)
    {
        $this->onConnection('database');
        $this->onQueue('payment-reconcile');
    }

    public function handle(DroidBrainRewardService $rewardService): void
    {
        $file = DB::table('droidbrain_files')->where('id', $this->fileId)->first();

        if (!$file) {
            return;
        }

        // Already processed — idempotency guard.
        if ($file->payment_status === 'complete') {
            return;
        }

        $rewardService->syncForFile($this->fileId, null, true);

        DB::table('droidbrain_files')
            ->where('id', $this->fileId)
            ->update([
                'payment_status' => 'complete',
                'updated_at' => now(),
            ]);
    }

    public function failed(\Throwable $exception): void
    {
        DB::table('droidbrain_files')
            ->where('id', $this->fileId)
            ->update([
                'payment_status' => 'failed',
                'updated_at' => now(),
            ]);
    }
}
