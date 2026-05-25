<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNavPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminNavPreferenceController extends Controller
{
    private const ALLOWED_VIEWS = [
        'home',
        'workerHealth',
        'websiteHealth',
        'tips',
        'tenets',
        'eotm',
        'weather',
        'users',
        'siteLock',
        'system',
        'discordBot',
        'combatValues',
        'entityStats',
        'memberChangelog',
        'logs',
        'memberAccessLogs',
        'droidbrainUploads',
        'toolStore',
        'jobPayRates',
    ];

    private const MAX_RECENTS = 6;
    private const MAX_FAVORITES = 20;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $prefs = AdminNavPreference::query()
            ->where('user_id', (int) $user->id)
            ->first();

        return response()->json([
            'ok' => true,
            'data' => [
                'recents'   => $this->normalizeViews($prefs?->recents, self::MAX_RECENTS),
                'favorites' => $this->normalizeViews($prefs?->favorites, self::MAX_FAVORITES),
            ],
        ]);
    }

    public function updateRecents(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'recents' => ['required', 'array', 'max:' . self::MAX_RECENTS],
            'recents.*' => ['required', 'string', 'in:' . implode(',', self::ALLOWED_VIEWS)],
        ]);

        $recents = $this->normalizeViews($validated['recents'] ?? [], self::MAX_RECENTS);

        $prefs = AdminNavPreference::query()->firstOrNew([
            'user_id' => (int) $user->id,
        ]);
        $prefs->recents = $recents;
        $prefs->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'recents' => $recents,
            ],
        ]);
    }

    public function updateFavorites(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'favorites'   => ['required', 'array', 'max:' . self::MAX_FAVORITES],
            'favorites.*' => ['required', 'string', 'in:' . implode(',', self::ALLOWED_VIEWS)],
        ]);

        $favorites = $this->normalizeViews($validated['favorites'] ?? [], self::MAX_FAVORITES);

        $prefs = AdminNavPreference::query()->firstOrNew([
            'user_id' => (int) $user->id,
        ]);
        $prefs->favorites = $favorites;
        $prefs->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'favorites' => $favorites,
            ],
        ]);
    }

    private function normalizeViews(mixed $views, int $max): array
    {
        $values  = is_array($views) ? $views : [];
        $allowed = array_flip(self::ALLOWED_VIEWS);
        $normalized = [];

        foreach ($values as $value) {
            if (!is_string($value)) {
                continue;
            }
            if (!isset($allowed[$value])) {
                continue;
            }
            if (in_array($value, $normalized, true)) {
                continue;
            }
            $normalized[] = $value;
            if (count($normalized) >= $max) {
                break;
            }
        }

        return $normalized;
    }
}

