<?php

namespace App\Observers;

use App\Models\Swc\SwcSectorSearchRecord;
use Illuminate\Support\Facades\Cache;

class SwcSectorSearchRecordObserver
{
    private static bool $pendingBump = false;

    public function saved(SwcSectorSearchRecord $record): void
    {
        self::$pendingBump = true;
    }

    public static function flushIfPending(): void
    {
        if (!self::$pendingBump) {
            return;
        }

        self::$pendingBump = false;
        Cache::forever(
            'universe:search-records:version',
            ((int) Cache::get('universe:search-records:version', 1)) + 1
        );
    }
}
