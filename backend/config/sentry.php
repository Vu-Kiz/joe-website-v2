<?php

return [
    'dsn' => env('SENTRY_LARAVEL_DSN'),

    'traces_sample_rate' => (float) env('SENTRY_TRACES_SAMPLE_RATE', 0.1),

    'profiles_sample_rate' => 0.0,

    'breadcrumbs' => [
        'cache'           => true,
        'livewire'        => false,
        'sql_queries'     => true,
        'sql_bindings'    => false,
        'queue_info'      => true,
        'command_info'    => true,
    ],

    'tracing' => [
        'queue_job_transactions'        => true,
        'queue_jobs'                    => true,
        'sql_queries'                   => true,
        'sql_origin'                    => false,
        'views'                         => false,
        'livewire'                      => false,
        'http_client_requests'          => true,
        'redis_commands'                => false,
        'requests'                      => true,
        'missing_routes'                => false,
        'created_by_package'            => true,
        'notifications'                 => false,
    ],

    'send_default_pii' => false,


    'ignore_exceptions' => [
        \Illuminate\Auth\AuthenticationException::class,
        \Illuminate\Validation\ValidationException::class,
        \Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
    ],
];
