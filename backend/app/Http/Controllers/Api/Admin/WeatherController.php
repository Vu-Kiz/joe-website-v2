<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\HotAdjective;
use App\Models\Weather\WeatherAdvice;
use App\Models\Weather\WeatherSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Admin\AdminActionLogger;

class WeatherController extends Controller
{
    public function index(): JsonResponse
    {
        $adjectives = HotAdjective::query()
            ->orderBy('min_temp')
            ->orderBy('id')
            ->get()
            ->map(fn (HotAdjective $item) => [
                'id' => $item->id,
                'word' => $item->word,
                'min_temp' => $item->min_temp,
                'max_temp' => $item->max_temp,
            ])
            ->values();

        $advice = WeatherAdvice::query()
            ->orderByDesc('is_active')
            ->orderByDesc('weight')
            ->orderBy('id')
            ->get()
            ->map(fn (WeatherAdvice $item) => [
                'id' => $item->id,
                'advice' => $item->advice,
                'weight' => $item->weight,
                'is_active' => (bool) $item->is_active,
                'created_at' => optional($item->created_at)?->toIso8601String(),
            ])
            ->values();

        $settings = WeatherSetting::query()->latest('id')->first();

        return response()->json([
            'ok' => true,
            'settings' => [
                'min_temp' => $settings?->min_temp ?? 34,
                'max_temp' => $settings?->max_temp ?? 57,
            ],
            'adjectives' => $adjectives,
            'advice' => $advice,
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'min_temp' => ['required', 'integer'],
            'max_temp' => ['required', 'integer', 'gte:min_temp'],
        ]);

        $settings = WeatherSetting::query()->latest('id')->first();

        $before = [
            'min_temp' => $settings?->min_temp ?? 34,
            'max_temp' => $settings?->max_temp ?? 57,
        ];

        if (!$settings) {
            $settings = new WeatherSetting();
            $settings->created_at = now();
        }

        $settings->min_temp = $validated['min_temp'];
        $settings->max_temp = $validated['max_temp'];
        $settings->save();

        $after = [
            'min_temp' => $settings->min_temp,
            'max_temp' => $settings->max_temp,
        ];

        AdminActionLogger::log(
            $request,
            'weather',
            'update_settings',
            'Updated weather generation range',
            'weather_settings',
            $settings->id,
            $before,
            $after
        );

        return response()->json([
            'ok' => true,
            'settings' => $after,
        ]);
    }

    public function storeAdjective(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'word' => ['required', 'string', 'max:100'],
            'min_temp' => ['required', 'integer'],
            'max_temp' => ['required', 'integer', 'gte:min_temp'],
        ]);

        $item = HotAdjective::create([
            'word' => trim($validated['word']),
            'min_temp' => $validated['min_temp'],
            'max_temp' => $validated['max_temp'],
        ]);

        $after = [
            'id' => $item->id,
            'word' => $item->word,
            'min_temp' => $item->min_temp,
            'max_temp' => $item->max_temp,
        ];

        AdminActionLogger::log(
            $request,
            'weather',
            'create_adjective',
            'Created weather adjective band',
            'hot_adjective',
            $item->id,
            null,
            $after
        );

        return response()->json([
            'ok' => true,
            'item' => $after,
        ], 201);
    }

    public function updateAdjective(Request $request, HotAdjective $hotAdjective): JsonResponse
    {
        $validated = $request->validate([
            'word' => ['required', 'string', 'max:100'],
            'min_temp' => ['required', 'integer'],
            'max_temp' => ['required', 'integer', 'gte:min_temp'],
        ]);

        $before = [
            'id' => $hotAdjective->id,
            'word' => $hotAdjective->word,
            'min_temp' => $hotAdjective->min_temp,
            'max_temp' => $hotAdjective->max_temp,
        ];

        $hotAdjective->word = trim($validated['word']);
        $hotAdjective->min_temp = $validated['min_temp'];
        $hotAdjective->max_temp = $validated['max_temp'];
        $hotAdjective->save();

        $after = [
            'id' => $hotAdjective->id,
            'word' => $hotAdjective->word,
            'min_temp' => $hotAdjective->min_temp,
            'max_temp' => $hotAdjective->max_temp,
        ];

        AdminActionLogger::log(
            $request,
            'weather',
            'update_adjective',
            'Updated weather adjective band',
            'hot_adjective',
            $hotAdjective->id,
            $before,
            $after
        );

        return response()->json([
            'ok' => true,
            'item' => $after,
        ]);
    }

    public function destroyAdjective(Request $request, HotAdjective $hotAdjective): JsonResponse
    {
        $before = [
            'id' => $hotAdjective->id,
            'word' => $hotAdjective->word,
            'min_temp' => $hotAdjective->min_temp,
            'max_temp' => $hotAdjective->max_temp,
        ];

        $targetId = $hotAdjective->id;
        $hotAdjective->delete();

        AdminActionLogger::log(
            $request,
            'weather',
            'delete_adjective',
            'Deleted weather adjective band',
            'hot_adjective',
            $targetId,
            $before,
            null
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    public function storeAdvice(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'advice' => ['required', 'string'],
            'weight' => ['required', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $item = new WeatherAdvice();
        $item->advice = trim($validated['advice']);
        $item->weight = $validated['weight'];
        $item->is_active = array_key_exists('is_active', $validated)
            ? (bool) $validated['is_active']
            : true;
        $item->created_at = now();
        $item->save();

        $after = [
            'id' => $item->id,
            'advice' => $item->advice,
            'weight' => $item->weight,
            'is_active' => (bool) $item->is_active,
        ];

        AdminActionLogger::log(
            $request,
            'weather',
            'create_advice',
            'Created weather advice entry',
            'weather_advice',
            $item->id,
            null,
            $after
        );

        return response()->json([
            'ok' => true,
            'item' => [
                ...$after,
                'created_at' => optional($item->created_at)?->toIso8601String(),
            ],
        ], 201);
    }

    public function updateAdvice(Request $request, WeatherAdvice $weatherAdvice): JsonResponse
    {
        $validated = $request->validate([
            'advice' => ['required', 'string'],
            'weight' => ['required', 'integer', 'min:1'],
            'is_active' => ['required', 'boolean'],
        ]);

        $before = [
            'id' => $weatherAdvice->id,
            'advice' => $weatherAdvice->advice,
            'weight' => $weatherAdvice->weight,
            'is_active' => (bool) $weatherAdvice->is_active,
        ];

        $weatherAdvice->advice = trim($validated['advice']);
        $weatherAdvice->weight = $validated['weight'];
        $weatherAdvice->is_active = (bool) $validated['is_active'];
        $weatherAdvice->save();

        $after = [
            'id' => $weatherAdvice->id,
            'advice' => $weatherAdvice->advice,
            'weight' => $weatherAdvice->weight,
            'is_active' => (bool) $weatherAdvice->is_active,
        ];

        AdminActionLogger::log(
            $request,
            'weather',
            'update_advice',
            'Updated weather advice entry',
            'weather_advice',
            $weatherAdvice->id,
            $before,
            $after
        );

        return response()->json([
            'ok' => true,
            'item' => [
                ...$after,
                'created_at' => optional($weatherAdvice->created_at)?->toIso8601String(),
            ],
        ]);
    }

    public function destroyAdvice(Request $request, WeatherAdvice $weatherAdvice): JsonResponse
    {
        $before = [
            'id' => $weatherAdvice->id,
            'advice' => $weatherAdvice->advice,
            'weight' => $weatherAdvice->weight,
            'is_active' => (bool) $weatherAdvice->is_active,
        ];

        $targetId = $weatherAdvice->id;
        $weatherAdvice->delete();

        AdminActionLogger::log(
            $request,
            'weather',
            'delete_advice',
            'Deleted weather advice entry',
            'weather_advice',
            $targetId,
            $before,
            null
        );

        return response()->json([
            'ok' => true,
        ]);
    }
}
