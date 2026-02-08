<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public static function payload(): array
    {
        $dbStatus = ['status' => 'unknown'];

        try {
            DB::select('SELECT 1');

            $dbStatus = [
                'status'   => 'ok',
                'driver'   => config('database.default'),
                'host'     => config('database.connections.' . config('database.default') . '.host'),
                'database' => config('database.connections.' . config('database.default') . '.database'),
            ];
        } catch (Throwable $e) {
            $dbStatus = [
                'status' => 'error',
                'error'  => $e->getMessage(),
            ];
        }

        return [
            'status'   => 'ok',
            'app'      => config('app.name'),
            'env'      => config('app.env'),
            'version'  => config('app.version', '0.1.0'),
            'timezone' => config('app.timezone'),
            'php'      => PHP_VERSION,
            'laravel'  => app()->version(),
            'database' => $dbStatus,
            'time'     => now()->toIso8601String(),
        ];
    }

    public function index()
    {
        return response()->json(self::payload());
    }
}
