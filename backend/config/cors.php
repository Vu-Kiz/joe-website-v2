<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'oauth/*', 'auth/discord', 'auth/discord/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', '')))),

    'allowed_origins_patterns' => [
        '#^chrome-extension://[a-z]{32}$#',
        '#^moz-extension://[A-Za-z0-9-]+$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => (bool) env('CORS_SUPPORTS_CREDENTIALS', true),
];
