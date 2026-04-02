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

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
