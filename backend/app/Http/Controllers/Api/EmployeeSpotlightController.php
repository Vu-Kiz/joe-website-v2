<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeSpotlight;
use Illuminate\Http\JsonResponse;

class EmployeeSpotlightController extends Controller
{
    public function current(): JsonResponse
    {
        $entry = EmployeeSpotlight::query()
            ->latest('created_at')
            ->latest('id')
            ->first();

        if (!$entry) {
            return response()->json([
                'ok' => true,
                'entry' => null,
            ]);
        }

        return response()->json([
            'ok' => true,
            'entry' => [
                'id' => $entry->id,
                'name' => $entry->name,
                'reason' => $entry->reason,
                'image_path' => $entry->image_path,
                'image_url' => $entry->image_url,
                'created_at' => optional($entry->created_at)?->toIso8601String(),
                'updated_at' => optional($entry->updated_at)?->toIso8601String(),
            ],
        ]);
    }
}