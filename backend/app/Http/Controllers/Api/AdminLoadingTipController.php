<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoadingTip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Admin\AdminActionLogger;

class AdminLoadingTipController extends Controller
{
    public function index(): JsonResponse
    {
        $tips = LoadingTip::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LoadingTip $tip) => [
                'id' => $tip->id,
                'tip' => $tip->tip,
                'created_at' => optional($tip->created_at)?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'tips' => $tips,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tip' => ['required', 'string'],
        ]);

        $tip = new LoadingTip();
        $tip->tip = $this->normaliseTip($validated['tip']);
        $tip->created_at = now();
        $tip->save();

        AdminActionLogger::log(
            $request,
            'tips',
            'create',
            'Created loading tip',
            'loading_tip',
            $tip->id,
            null,
            [
                'tip' => $tip->tip,
            ]
        );

        return response()->json([
            'ok' => true,
            'tip' => [
                'id' => $tip->id,
                'tip' => $tip->tip,
                'created_at' => optional($tip->created_at)?->toIso8601String(),
            ],
        ], 201);
    }

    public function update(Request $request, LoadingTip $loadingTip): JsonResponse
    {
        $validated = $request->validate([
            'tip' => ['required', 'string'],
        ]);

        $before = [
            'tip' => $loadingTip->tip,
        ];

        $loadingTip->tip = $this->normaliseTip($validated['tip']);
        $loadingTip->save();

        AdminActionLogger::log(
            $request,
            'tips',
            'update',
            'Updated loading tip',
            'loading_tip',
            $loadingTip->id,
            $before,
            [
                'tip' => $loadingTip->tip,
            ]
        );

        return response()->json([
            'ok' => true,
            'tip' => [
                'id' => $loadingTip->id,
                'tip' => $loadingTip->tip,
                'created_at' => optional($loadingTip->created_at)?->toIso8601String(),
            ],
        ]);
    }

    public function destroy(Request $request, LoadingTip $loadingTip): JsonResponse
    {
        $before = [
            'tip' => $loadingTip->tip,
        ];

        $targetId = $loadingTip->id;

        $loadingTip->delete();

        AdminActionLogger::log(
            $request,
            'tips',
            'delete',
            'Deleted loading tip',
            'loading_tip',
            $targetId,
            $before,
            null
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    private function normaliseTip(string $tip): string
    {
        $clean = trim($tip);

        $clean = preg_replace('/^\s*tip\s*:\s*/i', '', $clean) ?? $clean;
        $clean = trim($clean);

        return 'Tip: ' . $clean;
    }
}