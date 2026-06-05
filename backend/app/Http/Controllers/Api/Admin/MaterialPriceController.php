<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MaterialPrice;
use App\Models\Swc\SwcMaterialType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaterialPriceController extends Controller
{
    public function index(): JsonResponse
    {
        $prices = MaterialPrice::query()
            ->with('setBy:id,swc_handle')
            ->orderBy('material_name')
            ->get();

        return response()->json(['ok' => true, 'data' => $prices]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'material_uid'   => ['required', 'string', 'max:64'],
            'price_per_unit' => ['required', 'integer', 'min:0'],
        ]);

        $material = SwcMaterialType::where('uid', $validated['material_uid'])->first();

        if (!$material) {
            return response()->json(['ok' => false, 'message' => 'Material not found.'], 404);
        }

        $price = MaterialPrice::updateOrCreate(
            ['material_uid' => $validated['material_uid']],
            [
                'material_name'  => $material->name ?? $validated['material_uid'],
                'price_per_unit' => $validated['price_per_unit'],
                'set_by_user_id' => $request->user()->id,
            ]
        );

        $price->load('setBy:id,swc_handle');

        return response()->json(['ok' => true, 'data' => $price]);
    }

    public function destroy(string $materialUid): JsonResponse
    {
        MaterialPrice::where('material_uid', $materialUid)->delete();
        return response()->json(['ok' => true]);
    }
}
