<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoadingTip;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class LoadingTipController extends Controller
{
    /**
     * Return a random loading tip as JSON.
     */
    public function index(): JsonResponse
    {
        try {
            $tip = LoadingTip::inRandomOrder()->value('tip');

            if (! $tip) {
                $tip = 'No loading tips have been configured yet.';
            }

            return response()->json([
                'ok'  => true,
                'tip' => $tip,
            ]);
        } catch (\Throwable $e) {
            Log::error('LoadingTipController error', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'ok'    => false,
                'error' => 'Could not load tip from database.',
                'tip'   => 'Could not fetch tip — check server logs.',
            ], 500);
        }
    }
}
