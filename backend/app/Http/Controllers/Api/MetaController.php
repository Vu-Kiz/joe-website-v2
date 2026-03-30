<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'app' => [
                'name'        => 'Jawa Offworld Enterprises',
                'code'        => 'JOE',
                'environment' => config('app.env'),
                'version'     => config('app.version', '0.1.0'),
                'baseUrl'     => config('app.url'),
            ],

            // High-level modules the SPA can show/hide
            'modules' => [
                [
                    'key'   => 'jen',
                    'name'  => 'Jawa Entertainment Network',
                    'route' => '/jen',
                    'enabled' => true,
                ],
                [
                    'key'   => 'jobs',
                    'name'  => 'Jobs Board',
                    'route' => '/jobs',
                    'enabled' => true,
                ],
                [
                    'key'   => 'droidbrain',
                    'name'  => 'DroidBrain Intel',
                    'route' => '/intel/droidbrain',
                    'enabled' => true,
                ],
            ],

            // Example navigation skeleton for SPA
            'navigation' => [
                'main' => [
                    [
                        'label' => 'Dashboard',
                        'route' => '/',
                        'icon'  => 'home',
                    ],
                    [
                        'label' => 'JEN',
                        'route' => '/jen',
                        'icon'  => 'tv',
                    ],
                    [
                        'label' => 'Jobs',
                        'route' => '/jobs',
                        'icon'  => 'briefcase',
                    ],
                ],
            ],
        ]);
    }
}
