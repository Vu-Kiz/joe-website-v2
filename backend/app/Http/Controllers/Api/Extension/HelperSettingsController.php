<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Extension;

use App\Http\Controllers\Controller;
use App\Models\WreckingHelperSetting;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HelperSettingsController extends Controller
{
    private const DEFAULT_PREFIX = 'wrecker';

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!Permissions::hasAny($user, ['can_access_wrecking_helper_extension'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have access to Wrecking Helper settings.',
            ], 403);
        }

        /** @var WreckingHelperSetting|null $setting */
        $setting = WreckingHelperSetting::query()
            ->where('user_id', $user->id)
            ->first();

        return response()->json([
            'ok' => true,
            'prefix' => trim((string) ($setting?->prefix ?? self::DEFAULT_PREFIX)) ?: self::DEFAULT_PREFIX,
            'updated_at' => $setting?->updated_at?->toIso8601String(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!Permissions::hasAny($user, ['can_access_wrecking_helper_extension'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have access to Wrecking Helper settings.',
            ], 403);
        }

        $validated = $request->validate([
            'prefix' => ['required', 'string', 'max:80'],
        ]);

        $prefix = trim((string) $validated['prefix']);
        if ($prefix === '') {
            return response()->json([
                'ok' => false,
                'message' => 'Prefix cannot be empty.',
            ], 422);
        }

        /** @var WreckingHelperSetting $setting */
        $setting = WreckingHelperSetting::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['prefix' => $prefix]
        );

        return response()->json([
            'ok' => true,
            'prefix' => $setting->prefix,
            'updated_at' => $setting->updated_at?->toIso8601String(),
        ]);
    }
}
