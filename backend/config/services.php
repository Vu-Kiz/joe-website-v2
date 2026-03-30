<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'droidbrain_rewards' => [
        'payer_faction_id' => env('DROIDBRAIN_REWARD_PAYER_FACTION_ID'),
        'payer_faction_swc_uid' => env('DROIDBRAIN_REWARD_PAYER_FACTION_SWC_UID', '20:1376'),
    ],

    'jobs_discord' => [
        'webhook_url' => env('JOBS_DISCORD_WEBHOOK_URL', ''),
        'frontend_url' => env('JOBS_DISCORD_FRONTEND_URL', env('DISCORD_FRONTEND_URL', env('SWC_FRONTEND_URL'))),
    ],

];
