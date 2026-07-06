<?php

namespace App\Jobs;

use App\Support\DroidBrain\DroidBrainRewardService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessAllPendingPaymentsJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;
    public int $timeout = 3600;

    public function __construct()
    {
        $this->onConnection('database');
        $this->onQueue('payment-reconcile');
    }

    public function handle(DroidBrainRewardService $rewardService): void
    {
        $this->processDroidBrainPayments($rewardService);
    }

    private function processDroidBrainPayments(DroidBrainRewardService $rewardService): void
    {
        $pending = DB::table('droidbrain_files')
            ->where('payment_status', 'pending')
            ->orderBy('id')
            ->pluck('id');

        foreach ($pending as $fileId) {
            try {
                $rewardService->syncForFile((int) $fileId, null, true);

                DB::table('droidbrain_files')
                    ->where('id', $fileId)
                    ->update(['payment_status' => 'complete', 'updated_at' => now()]);
            } catch (\Throwable $e) {
                // Mark the file failed BEFORE attempting to log — if Log::error() itself
                // throws (e.g. the log stream can't be opened, which has happened in this
                // app before), it must not stop this file from being marked failed, and it
                // must not abort the loop and leave every subsequent pending file stuck
                // forever behind this one.
                DB::table('droidbrain_files')
                    ->where('id', $fileId)
                    ->update([
                        'payment_status' => 'failed',
                        'payment_error'  => substr($e->getMessage(), 0, 2000),
                        'updated_at'     => now(),
                    ]);

                try {
                    Log::error('ProcessAllPendingPaymentsJob: DroidBrain payment failed', [
                        'file_id' => $fileId,
                        'error'   => $e->getMessage(),
                    ]);
                } catch (\Throwable $logException) {
                    // Logging failed too — nothing more we can do here, but the payment
                    // status above is already saved, so the batch can continue.
                }
            }
        }
    }
}
