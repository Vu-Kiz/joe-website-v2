<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\MarketVendorSyncJob;
use App\Models\Swc\SwcMarketVendor;
use App\Models\Swc\SwcMarketVendorListing;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class MarketVendorAdminController extends Controller
{
    public function status(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => [
                'vendor_count' => SwcMarketVendor::count(),
                'listing_count' => SwcMarketVendorListing::count(),
                'unmatched_listing_count' => SwcMarketVendorListing::whereNull('matched_item_type_uid')->count(),
                'last_synced_at' => SwcMarketVendor::max('last_synced_at'),
            ],
        ]);
    }

    public function syncNow(): JsonResponse
    {
        $lockKey = 'laravel_unique_job:' . MarketVendorSyncJob::class . 'market-vendor-sync';
        Cache::forget($lockKey);

        MarketVendorSyncJob::dispatch();

        return response()->json(['ok' => true, 'message' => 'Vendor sync dispatched.']);
    }
}
