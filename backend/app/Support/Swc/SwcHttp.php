<?php

declare(strict_types=1);

namespace App\Support\Swc;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

final class SwcHttp
{
    public static function make(?string $accessToken = null, string $authMode = 'oauth'): PendingRequest
    {
        $ua = (string) Config::get('swc.http_user_agent', 'JOE API Client');

        $req = Http::withHeaders([
            'User-Agent' => $ua,
            'Accept' => 'application/json',
        ])->timeout(20);

        if ($accessToken) {
            if ($authMode === 'bearer') {
                $req = $req->withToken($accessToken);
            } else {
                $req = $req->withHeaders([
                    'Authorization' => 'OAuth ' . $accessToken,
                ]);
            }
        }

        return $req;
    }

    public static function getWithOrderedAuthFallback(
        string $url,
        array $query,
        string $accessToken,
        array $modes = ['oauth', 'bearer']
    ): array {
        $attempts = [];

        foreach ($modes as $mode) {
            $response = self::make($accessToken, $mode)->get($url, $query);

            $attempts[$mode] = [
                'status' => $response->status(),
                'ok' => $response->ok(),
                'body' => $response->body(),
                'json' => $response->json(),
            ];

            if ($response->ok()) {
                return [
                    'mode' => $mode,
                    'response' => $response,
                    'attempts' => $attempts,
                ];
            }
        }

        $finalMode = $modes[0] ?? 'oauth';
        $finalResponse = self::make($accessToken, $finalMode)->get($url, $query);

        return [
            'mode' => $finalMode,
            'response' => $finalResponse,
            'attempts' => $attempts,
        ];
    }
}