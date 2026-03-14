<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenetOfSalvage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminTenetOfSalvageController extends Controller
{
    public function index(): JsonResponse
    {
        $items = TenetOfSalvage::query()
            ->orderByDesc('weight')
            ->orderBy('title')
            ->get();

        return response()->json([
            'ok' => true,
            'items' => $items,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'body_bbcode' => ['required', 'string'],
            'weight' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $item = TenetOfSalvage::create([
            'title' => $data['title'],
            'body_bbcode' => $data['body_bbcode'],
            'weight' => $data['weight'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'ok' => true,
            'item' => $item,
        ], 201);
    }

    public function update(Request $request, TenetOfSalvage $tenetOfSalvage): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'body_bbcode' => ['required', 'string'],
            'weight' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $tenetOfSalvage->update([
            'title' => $data['title'],
            'body_bbcode' => $data['body_bbcode'],
            'weight' => $data['weight'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'ok' => true,
            'item' => $tenetOfSalvage->fresh(),
        ]);
    }

    public function destroy(TenetOfSalvage $tenetOfSalvage): JsonResponse
    {
        $tenetOfSalvage->delete();

        return response()->json([
            'ok' => true,
        ]);
    }
}