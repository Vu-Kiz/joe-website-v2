<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Support\Swc\MarketVendorSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class MarketVendorSyncJob implements ShouldQueue, ShouldBeUnique
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
        $this->onQueue('swc-sync');
    }

    public function uniqueId(): string
    {
        return 'market-vendor-sync';
    }

    public function handle(MarketVendorSyncService $service): void
    {
        $result = $service->syncAll();

        Log::info('Market vendor sync complete', $result);
    }
}
