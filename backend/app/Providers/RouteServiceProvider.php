<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $actorKey = $request->user()?->id
                ? ('user:' . $request->user()->id)
                : ('ip:' . $request->ip());

            $globalPerMinute = $request->user()
                ? 600
                : 240;

            $perRoutePerMinute = $request->user()
                ? 240
                : 120;

            return [
                Limit::perMinute($globalPerMinute)
                    ->by('api-global:' . $actorKey),
                Limit::perMinute($perRoutePerMinute)
                    ->by('api-route:' . $actorKey . '|' . $request->method() . '|' . $request->path()),
            ];
        });

        RateLimiter::for('payments-send', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_PAYMENTS_SEND', 10))
                ->by('payments-send:user:' . $request->user()?->id);
        });

        RateLimiter::for('payments-bulk', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_PAYMENTS_BULK', 5))
                ->by('payments-bulk:user:' . $request->user()?->id);
        });

        RateLimiter::for('market-order', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_MARKET_ORDER', 20))
                ->by('market-order:user:' . $request->user()?->id);
        });

        RateLimiter::for('market-pay', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_MARKET_PAY', 10))
                ->by('market-pay:user:' . $request->user()?->id);
        });

        RateLimiter::for('credit-log-pull', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_CREDIT_LOG_PULL', 3))
                ->by('credit-log-pull:user:' . $request->user()?->id);
        });

        RateLimiter::for('import-personal-events', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_IMPORT_PERSONAL_EVENTS', 2))
                ->by('import-personal-events:user:' . $request->user()?->id);
        });

        RateLimiter::for('rm-browser', function (Request $request) {
            return Limit::perMinute((int) env('RATE_LIMIT_RM_BROWSER', 6))
                ->by('rm-browser:user:' . $request->user()?->id);
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
