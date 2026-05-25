<?php

namespace App\Support\Swc;

use App\Models\Swc\SwcTimeState;
use Carbon\Carbon;

class CombineTime
{
    private const CACHE_ID = 1;
    private const MAX_AGE_HOURS = 24; // re-pull from SWC at most once a day

    /**
     * Return a fresh (or cached) SWC time state.
     * This only calls SWC API if our cache is missing or too old.
     */
    public static function getState(): SwcTimeState
    {
        $state = SwcTimeState::find(self::CACHE_ID);

        if ($state && $state->refreshed_at->gt(now()->subHours(self::MAX_AGE_HOURS))) {
            // Cache is still fresh enough
            return $state;
        }

        // Need to fetch real SWC time
        $payload = self::fetchFromSwc();

        if (!$payload) {
            // If fetch fails but we have old cache, use it
            if ($state) {
                return $state;
            }

            // Absolute fallback if nothing exists
            $fallback = SwcTimeState::make([
                'year'        => 0,
                'day'         => 0,
                'hours'       => 0,
                'mins'        => 0,
                'secs'        => 0,
                'swc_seconds' => 0,
                'refreshed_at'=> now(),
            ]);
            $fallback->id = self::CACHE_ID;
            return $fallback;
        }

        // Map SWC payload to our state
        $year = (int)($payload['years'] ?? 0);
        $day  = (int)($payload['days']  ?? 0);
        $h    = (int)($payload['hours'] ?? 0);
        $m    = (int)($payload['mins']  ?? 0);
        $s    = (int)($payload['secs']  ?? 0);

        // You can pick any epoch; this is just "seconds from year 0 day 0" for easy math
        $swcSeconds = $s + $m * 60 + $h * 3600 + $day * 86400 + $year * 365 * 86400;

        if (!$state) {
            $state = new SwcTimeState();
            $state->id = self::CACHE_ID;
        }

        $state->fill([
            'year'        => $year,
            'day'         => $day,
            'hours'       => $h,
            'mins'        => $m,
            'secs'        => $s,
            'swc_seconds' => $swcSeconds,
            'refreshed_at'=> now(),
        ]);

        $state->save();

        return $state;
    }

    /**
     * Fetch from SWC API once. Returns associative array or null on error.
     */
    private static function fetchFromSwc(): ?array
    {
        $url = 'https://www.swcombine.com/ws/v2.0/api/time/';

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_USERAGENT      => 'JOE-Site-CGT/2.0 (+https://www.swc-joe.com/)',
            CURLOPT_TIMEOUT        => 5,
        ]);

        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($err || $body === false || $body === '') {
            logger()->warning('CombineTime fetch error', [
                'code'  => $code,
                'error' => $err ?: 'no body',
            ]);
            return null;
        }

        $data = json_decode($body, true);

        if (!is_array($data) || !isset($data['swcapi']) || !is_array($data['swcapi'])) {
            logger()->warning('CombineTime unexpected response', [
                'code' => $code,
                'body' => substr($body, 0, 300),
            ]);
            return null;
        }

        return $data['swcapi'];
    }

    /**
     * Human-readable CGT string (v1 style).
     */
    public static function currentCgtString(): string
    {
        $state = self::getState();

        if ($state->year === 0 && $state->day === 0) {
            return 'CGT unavailable';
        }

        $h = str_pad((string) $state->hours, 2, '0', STR_PAD_LEFT);
        $m = str_pad((string) $state->mins,  2, '0', STR_PAD_LEFT);

        return "Year {$state->year} Day {$state->day} · {$h}:{$m}";
    }
}