<?php

declare(strict_types=1);

namespace App\Http;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

class ApiClient
{
    /**
     * Base client for all Star Wars Combine WS calls.
     * Sets User-Agent + JSON accept so we don't get the bot page.
     */
    public static function swc(): PendingRequest
    {
        $ua = (string) Config::get(
            'swc.user_agent',
            'JOE v2 Backend (joe-swc.com contact: admin@joe-swc.com)'
        );

        return Http::withHeaders([
            'User-Agent' => $ua,
            'Accept'     => 'application/json',
        ]);
    }

    /**
     * If you ever want a generic external API client later
     * (no special UA), you can add a plain() here.
     */
    public static function plain(): PendingRequest
    {
        return Http::withHeaders([
            'Accept' => 'application/json',
        ]);
    }
}
