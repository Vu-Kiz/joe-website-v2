<?php

namespace App\Console;

use App\Jobs\ProcessAllPendingPaymentsJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('droidbrain:recover-stuck-uploads')->everyFifteenMinutes();
        $schedule->job(new ProcessAllPendingPaymentsJob())->dailyAt('03:00');
        $schedule->command('tool-subscriptions:expire')->hourly();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
