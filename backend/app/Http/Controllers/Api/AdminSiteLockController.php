<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Admin\SiteLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSiteLockController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'site_lock' => SiteLock::getMeta(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'message' => ['nullable', 'string', 'max:5000'],
        ]);

        $actor = (string) (
            $request->user()?->swc_character_id
            ?? $request->user()?->id
            ?? ''
        );

        SiteLock::setLock(
            (bool) $data['enabled'],
            trim((string) ($data['message'] ?? '')),
            $actor
        );

        return response()->json([
            'ok' => true,
            'message' => (bool) $data['enabled']
                ? 'Site lock enabled.'
                : 'Site lock disabled.',
            'site_lock' => SiteLock::getMeta(),
        ]);
    }
}