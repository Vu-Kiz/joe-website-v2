<?php

namespace App\Providers;

use App\Models\Swc\SwcSectorSearchRecord;
use App\Observers\SwcSectorSearchRecordObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        SwcSectorSearchRecord::observe(SwcSectorSearchRecordObserver::class);

        app()->terminating(function () {
            SwcSectorSearchRecordObserver::flushIfPending();
        });
    }
}
