<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenetOfSalvage;
use Illuminate\Http\JsonResponse;

class TenetOfSalvageController extends Controller
{
    public function index(): JsonResponse
    {
        $items = TenetOfSalvage::query()
            ->where('is_active', true)
            ->orderByDesc('weight')
            ->orderBy('title')
            ->get();

        return response()->json([
            'ok' => true,
            'items' => $items,
        ]);
    }
}