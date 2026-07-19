<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcMarketVendor;
use App\Models\Swc\SwcMarketVendorListing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketVendorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:20'],
            'vendor_id' => ['sometimes', 'nullable', 'integer'],
            'owner_label' => ['sometimes', 'nullable', 'string', 'max:150'],
            'sort' => ['sometimes', 'nullable', 'string', 'in:price_asc,price_desc,quantity_desc,name_asc,distance_asc'],
            'my_galx' => ['sometimes', 'nullable', 'integer'],
            'my_galy' => ['sometimes', 'nullable', 'integer'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = trim((string) ($validated['q'] ?? ''));
        $entityType = $validated['entity_type'] ?? null;
        $vendorId = $validated['vendor_id'] ?? null;
        $ownerLabel = $validated['owner_label'] ?? null;
        $sort = $validated['sort'] ?? 'name_asc';
        $myGalx = $validated['my_galx'] ?? null;
        $myGaly = $validated['my_galy'] ?? null;
        $sortByDistance = $sort === 'distance_asc' && $myGalx !== null && $myGaly !== null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        $listingsQuery = SwcMarketVendorListing::query()
            ->with('vendor:id,name,owner_label,system_label,container_label,planet_label,city_label,galx,galy,system_x,system_y,surface_x,surface_y,ground_x,ground_y,last_synced_at');

        if ($sortByDistance) {
            $listingsQuery
                ->join('swc_market_vendors', 'swc_market_vendors.id', '=', 'swc_market_vendor_listings.vendor_id')
                ->select('swc_market_vendor_listings.*');
        }

        $listings = $listingsQuery
            ->when($query !== '', fn ($q) => $q->where('ware_name', 'like', "%{$query}%"))
            ->when($entityType, fn ($q) => $q->where('matched_entity_type', $entityType))
            ->when($vendorId, fn ($q) => $q->where('vendor_id', $vendorId))
            ->when($ownerLabel, fn ($q) => $q->whereHas('vendor', fn ($vq) => $vq->where('owner_label', $ownerLabel)))
            ->when($sort === 'price_asc', fn ($q) => $q->orderBy('price', 'asc'))
            ->when($sort === 'price_desc', fn ($q) => $q->orderBy('price', 'desc'))
            ->when($sort === 'quantity_desc', fn ($q) => $q->orderBy('quantity', 'desc'))
            ->when($sort === 'name_asc' || ($sort === 'distance_asc' && !$sortByDistance), fn ($q) => $q->orderBy('ware_name', 'asc'))
            ->when($sortByDistance, fn ($q) => $q->orderByRaw(
                'POW(swc_market_vendors.galx - ?, 2) + POW(swc_market_vendors.galy - ?, 2) asc',
                [$myGalx, $myGaly]
            ))
            ->paginate($perPage);

        return response()->json([
            'ok' => true,
            'data' => $listings->items(),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
                'per_page' => $listings->perPage(),
            ],
        ]);
    }

    public function vendors(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'owner_label' => ['sometimes', 'nullable', 'string', 'max:150'],
            'galx' => ['sometimes', 'nullable', 'integer'],
            'galy' => ['sometimes', 'nullable', 'integer'],
            'sort' => ['sometimes', 'nullable', 'string', 'in:name_asc,owner_label_asc,location_asc,listings_desc,distance_asc'],
            'my_galx' => ['sometimes', 'nullable', 'integer'],
            'my_galy' => ['sometimes', 'nullable', 'integer'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = trim((string) ($validated['q'] ?? ''));
        $ownerLabel = $validated['owner_label'] ?? null;
        $galx = array_key_exists('galx', $validated) ? $validated['galx'] : null;
        $galy = array_key_exists('galy', $validated) ? $validated['galy'] : null;
        $sort = $validated['sort'] ?? 'name_asc';
        $myGalx = $validated['my_galx'] ?? null;
        $myGaly = $validated['my_galy'] ?? null;
        $sortByDistance = $sort === 'distance_asc' && $myGalx !== null && $myGaly !== null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        $vendors = SwcMarketVendor::query()
            ->withCount('listings')
            ->has('listings')
            ->when($query !== '', function ($q) use ($query) {
                $q->where(function ($inner) use ($query) {
                    $inner->where('name', 'like', "%{$query}%")
                        ->orWhere('owner_label', 'like', "%{$query}%");
                });
            })
            ->when($ownerLabel, fn ($q) => $q->where('owner_label', $ownerLabel))
            ->when($galx !== null && $galy !== null, fn ($q) => $q->where('galx', $galx)->where('galy', $galy))
            ->when($sort === 'name_asc', fn ($q) => $q->orderBy('name'))
            ->when($sort === 'owner_label_asc', fn ($q) => $q->orderBy('owner_label')->orderBy('name'))
            ->when($sort === 'location_asc', fn ($q) => $q->orderBy('system_label')->orderBy('name'))
            ->when($sort === 'listings_desc', fn ($q) => $q->orderBy('listings_count', 'desc')->orderBy('name'))
            ->when($sort === 'distance_asc' && !$sortByDistance, fn ($q) => $q->orderBy('name'))
            ->when($sortByDistance, fn ($q) => $q->orderByRaw(
                'POW(galx - ?, 2) + POW(galy - ?, 2) asc',
                [$myGalx, $myGaly]
            ))
            ->paginate($perPage);

        $owners = [];
        if ($query !== '') {
            $owners = SwcMarketVendor::query()
                ->whereNotNull('owner_label')
                ->has('listings')
                ->where('owner_label', 'like', "%{$query}%")
                ->selectRaw('owner_label, count(*) as vendor_count')
                ->groupBy('owner_label')
                ->orderBy('owner_label')
                ->limit(5)
                ->get()
                ->map(fn ($row) => ['label' => $row->owner_label, 'vendor_count' => (int) $row->vendor_count])
                ->values()
                ->all();
        }

        return response()->json([
            'ok' => true,
            'data' => $vendors->items(),
            'owners' => $owners,
            'meta' => [
                'current_page' => $vendors->currentPage(),
                'last_page' => $vendors->lastPage(),
                'total' => $vendors->total(),
                'per_page' => $vendors->perPage(),
            ],
        ]);
    }

    public function owners(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'sort' => ['sometimes', 'nullable', 'string', 'in:label_asc,vendors_desc'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = trim((string) ($validated['q'] ?? ''));
        $sort = $validated['sort'] ?? 'label_asc';
        $perPage = (int) ($validated['per_page'] ?? 25);

        $ownersQuery = SwcMarketVendor::query()
            ->whereNotNull('owner_label')
            ->has('listings')
            ->when($query !== '', fn ($q) => $q->where('owner_label', 'like', "%{$query}%"))
            ->selectRaw('owner_label, count(*) as vendor_count')
            ->groupBy('owner_label');

        $ownersQuery = $sort === 'vendors_desc'
            ? $ownersQuery->orderBy('vendor_count', 'desc')->orderBy('owner_label')
            : $ownersQuery->orderBy('owner_label');

        $owners = $ownersQuery->paginate($perPage);

        $owners->setCollection(
            $owners->getCollection()->map(fn ($row) => [
                'label' => $row->owner_label,
                'vendor_count' => (int) $row->vendor_count,
            ])
        );

        return response()->json([
            'ok' => true,
            'data' => $owners->items(),
            'meta' => [
                'current_page' => $owners->currentPage(),
                'last_page' => $owners->lastPage(),
                'total' => $owners->total(),
                'per_page' => $owners->perPage(),
            ],
        ]);
    }

    public function hubs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'sort' => ['sometimes', 'nullable', 'string', 'in:label_asc,vendors_desc,distance_asc'],
            'my_galx' => ['sometimes', 'nullable', 'integer'],
            'my_galy' => ['sometimes', 'nullable', 'integer'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = trim((string) ($validated['q'] ?? ''));
        $sort = $validated['sort'] ?? 'vendors_desc';
        $myGalx = $validated['my_galx'] ?? null;
        $myGaly = $validated['my_galy'] ?? null;
        $sortByDistance = $sort === 'distance_asc' && $myGalx !== null && $myGaly !== null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        // A "hub" is the building/ship/station vendors actually sit in (container_label,
        // e.g. "The Galactic Bazaar", "TFSS Asrat Plaza 2.0") rather than the system —
        // members recognize hubs by that name, not by the star system they're orbiting.
        // Fall back to the system label for the rare vendor with no reported container.
        $hubLabelExpr = "COALESCE(NULLIF(container_label, ''), system_label)";

        $hubsQuery = SwcMarketVendor::query()
            ->whereNotNull('galx')
            ->whereNotNull('galy')
            ->has('listings')
            ->when($query !== '', fn ($q) => $q->whereRaw("{$hubLabelExpr} like ?", ["%{$query}%"]))
            ->selectRaw("galx, galy, {$hubLabelExpr} as hub_label, count(*) as vendor_count")
            ->groupBy('galx', 'galy', 'hub_label')
            ->havingRaw('count(*) >= 10');

        if ($sortByDistance) {
            $hubsQuery->orderByRaw('POW(galx - ?, 2) + POW(galy - ?, 2) asc', [$myGalx, $myGaly]);
        } elseif ($sort === 'label_asc') {
            $hubsQuery->orderBy('hub_label');
        } else {
            $hubsQuery->orderBy('vendor_count', 'desc')->orderBy('hub_label');
        }

        $hubs = $hubsQuery->paginate($perPage);

        $hubs->setCollection(
            $hubs->getCollection()->map(fn ($row) => [
                'galx' => (int) $row->galx,
                'galy' => (int) $row->galy,
                'hub_label' => $row->hub_label,
                'vendor_count' => (int) $row->vendor_count,
            ])
        );

        return response()->json([
            'ok' => true,
            'data' => $hubs->items(),
            'meta' => [
                'current_page' => $hubs->currentPage(),
                'last_page' => $hubs->lastPage(),
                'total' => $hubs->total(),
                'per_page' => $hubs->perPage(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $vendor = SwcMarketVendor::query()->with('listings')->find($id);

        if (!$vendor) {
            return response()->json(['ok' => false, 'message' => 'Vendor not found.'], 404);
        }

        return response()->json(['ok' => true, 'data' => $vendor]);
    }
}
