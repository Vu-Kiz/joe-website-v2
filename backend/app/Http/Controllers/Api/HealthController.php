<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status'   => 'ok',
            'app'      => 'Jawa Offworld Enterprises v2 (Dev)',
            'version'  => config('app.version', '0.1.0'),
            'timezone' => config('app.timezone'),
            'php'      => PHP_VERSION,
            'laravel'  => app()->version(),
            'time'     => now()->toIso8601String(),
        ]);
    }
}
