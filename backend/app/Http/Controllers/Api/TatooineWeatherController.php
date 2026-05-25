<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotAdjective;
use App\Models\Weather\TatooineDailyWeather;
use App\Models\Weather\WeatherAdvice;
use App\Models\Weather\WeatherSetting;
use Illuminate\Http\JsonResponse;

class TatooineWeatherController extends Controller
{
    public function show(): JsonResponse
    {
        $today = now()->toDateString();

        $existing = TatooineDailyWeather::query()
            ->whereDate('weather_date', $today)
            ->latest('id')
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => true,
                'weather' => $this->transform($existing),
            ]);
        }

        $settings = WeatherSetting::query()->latest('id')->first();

        $minTemp = $settings?->min_temp ?? 34;
        $maxTemp = $settings?->max_temp ?? 57;

        if ($maxTemp < $minTemp) {
            [$minTemp, $maxTemp] = [$maxTemp, $minTemp];
        }

        $temperature = random_int($minTemp, $maxTemp);

        $adjective = HotAdjective::query()
            ->where('min_temp', '<=', $temperature)
            ->where('max_temp', '>=', $temperature)
            ->orderBy('min_temp')
            ->first();

        $word = $adjective?->word ?: 'hot';
        $advice = $this->pickAdvice() ?: 'Avoid extended exposure and stay near shade where possible.';
        $message = "Today on Tatooine it is {$temperature}° Standard and {$word}. {$advice}";

        $weather = new TatooineDailyWeather();
        $weather->weather_date = $today;
        $weather->temperature = $temperature;
        $weather->adjective = $word;
        $weather->advice = $advice;
        $weather->message = $message;
        $weather->created_at = now();
        $weather->save();

        return response()->json([
            'ok' => true,
            'weather' => $this->transform($weather),
        ]);
    }

    private function pickAdvice(): ?string
    {
        $items = WeatherAdvice::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['advice', 'weight']);

        if ($items->isEmpty()) {
            return null;
        }

        $pool = [];

        foreach ($items as $item) {
            $weight = max(1, (int) $item->weight);

            for ($i = 0; $i < $weight; $i++) {
                $pool[] = $item->advice;
            }
        }

        if (!$pool) {
            return null;
        }

        return $pool[array_rand($pool)];
    }

    private function transform(TatooineDailyWeather $weather): array
    {
        return [
            'id' => $weather->id,
            'weather_date' => optional($weather->weather_date)?->toDateString(),
            'temperature' => $weather->temperature,
            'adjective' => $weather->adjective,
            'advice' => $weather->advice,
            'message' => $weather->message,
            'created_at' => optional($weather->created_at)?->toIso8601String(),
        ];
    }
}