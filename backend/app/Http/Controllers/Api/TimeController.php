<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Swc\CombineTime;
use Illuminate\Http\JsonResponse;

class TimeController extends Controller
{
    public function show(): JsonResponse
    {
        $state = CombineTime::getState();

        return response()->json([
            'ok'  => true,
            'cgt' => [
                'year'  => $state->year,
                'day'   => $state->day,
                'hours' => $state->hours,
                'mins'  => $state->mins,
                'secs'  => $state->secs,
                'string'=> CombineTime::currentCgtString(),
            ],
            'swc_seconds' => $state->swc_seconds,
            'refreshed_at'=> $state->refreshed_at->toIso8601String(),
            'server_now'  => now()->toIso8601String(),
        ]);
    }
}