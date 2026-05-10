<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MarketEntityTypeSearchController extends Controller
{
    private const ENTITY_TABLES = [
        'ship'     => 'swc_ship_types',
        'vehicle'  => 'swc_vehicle_types',
        'station'  => 'swc_station_types',
        'facility' => 'swc_facility_types',
        'droid'    => 'swc_droid_types',
        'item'     => 'swc_item_types',
        'npc'      => 'swc_npc_types',
        'creature' => 'swc_creature_types',
        'material' => 'swc_material_types',
        'weapon'   => 'swc_weapon_types',
    ];

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $limit = 20;

        if ($q === '') {
            return response()->json(['results' => []]);
        }

        $unions = [];
        $bindings = [];

        foreach (self::ENTITY_TABLES as $category => $table) {
            $unions[] = "SELECT uid, name, image_url, ? AS category FROM `{$table}` WHERE name LIKE ?";
            $bindings[] = $category;
            $bindings[] = '%' . $q . '%';
        }

        $sql = implode(' UNION ALL ', $unions) . ' ORDER BY name ASC LIMIT ' . $limit;

        $rows = DB::select($sql, $bindings);

        $results = array_map(fn ($row) => [
            'uid'       => $row->uid,
            'name'      => $row->name,
            'image_url' => $row->image_url,
            'category'  => $row->category,
        ], $rows);

        return response()->json(['results' => $results]);
    }
}
