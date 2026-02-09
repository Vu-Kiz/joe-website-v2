<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function index()
    {
        $dbStatus  = 'ok';
        $dbError   = null;
        $driver    = config('database.default');
        $connection = config("database.connections.{$driver}");

        try {
            DB::select('SELECT 1');
        } catch (\Throwable $e) {
            $dbStatus = 'error';
            $dbError  = $e->getMessage();
        }

        return response()->json([
            'status'   => 'ok',
            'app'      => config('app.name'),
            'env'      => config('app.env'),
            'version'  => config('app.version', '0.1.0'),
            'timezone' => config('app.timezone'),
            'php'      => PHP_VERSION,
            'laravel'  => app()->version(),
            'time'     => now()->toIso8601String(),

            // 👇 matches your React component: data.database
            'database' => [
                'status'   => $dbStatus,
                'driver'   => $driver,
                'host'     => $connection['host']     ?? null,
                'database' => $connection['database'] ?? null,
                'error'    => $dbError,
            ],
        ]);
    }
}
