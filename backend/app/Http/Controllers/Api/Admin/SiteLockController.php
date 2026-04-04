<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\Admin\AdminActionLogger;
use App\Support\Admin\SiteLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteLockController extends Controller
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

        $before = SiteLock::getMeta();

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

        $after = SiteLock::getMeta();

        AdminActionLogger::log(
            $request,
            'site_lock',
            (bool) $data['enabled'] ? 'enable' : 'disable',
            (bool) $data['enabled'] ? 'Enabled the site lock.' : 'Disabled the site lock.',
            'site_lock',
            null,
            is_array($before) ? $before : null,
            is_array($after) ? $after : null
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
