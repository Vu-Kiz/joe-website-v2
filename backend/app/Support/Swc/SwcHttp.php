<?php

declare(strict_types=1);

namespace App\Support\Swc;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

final class SwcHttp
{
    public static function make(?string $accessToken = null): PendingRequest
    {
        $ua = (string) Config::get('swc.user_agent', 'JOE (SWC API Client)');

        $req = Http::withHeaders([
            'User-Agent' => $ua,
            'Accept'     => 'application/json',
        ])->timeout(20);

        if ($accessToken) {
            // SWC supports Authorization: OAuth <token> (per docs)
            $req = $req->withHeaders([
                'Authorization' => 'OAuth ' . $accessToken,
            ]);
        }

        return $req;
    }
}
