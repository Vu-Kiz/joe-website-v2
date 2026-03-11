<?php

namespace App\Http\Controllers\Api\Sys;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UniversePullController extends Controller
{
    /**
     * POST /api/sys/universe/pull
     * Sysadmin-only.
     *
     * Stub for now — wire to your actual import service later.
     */
    public function run(Request $request): JsonResponse
    {
        // Later you’ll call your real service, queue a job, etc.
        // Example:
        // dispatch(new \App\Jobs\UniversePullJob());

        return response()->json([
            'ok' => true,
            'message' => 'Universe pull triggered (stub)',
        ]);
    }
}