<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

class HealthController extends Controller
{
    public function index()
    {
        return response()->json([
            'status'   => 'ok',
            'app'      => config('app.name'),              // 👈 from .env
            'env'      => config('app.env'),               // 👈 dev / production
            'version'  => config('app.version', '2.1.0'),  // optional
            'timezone' => config('app.timezone'),
            'php'      => PHP_VERSION,
            'laravel'  => app()->version(),
            'time'     => now()->toIso8601String(),
        ]);
    }
}
