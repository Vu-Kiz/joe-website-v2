<?php

declare(strict_types=1);

namespace App\Support\Swc;

use App\Models\Swc\SwcCreatureType;
use App\Models\Swc\SwcDroidType;
use App\Models\Swc\SwcItemType;
use App\Models\Swc\SwcMarketVendor;
use App\Models\Swc\SwcMarketVendorListing;
use App\Models\Swc\SwcMaterialType;
use App\Models\Swc\SwcShipType;
use App\Models\Swc\SwcVehicleType;
use App\Models\Swc\SwcWeaponType;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MarketVendorSyncService
{
    private const LIST_PAGE_SIZE = 50;
    private const DETAIL_POOL_SIZE = 12;

    public function syncAll(): array
    {
        $vendorSummaries = $this->pullVendorList();
        $swcVendorIds = array_column($vendorSummaries, 'id');

        $detailResults = $this->pullVendorDetailsPooled($swcVendorIds);

        $synced = 0;
        $failed = 0;

        foreach ($detailResults as $swcVendorId => $detail) {
            if ($detail === null) {
                $failed++;
                continue;
            }

            $this->upsertVendor($detail);
            $synced++;
        }

        $removed = $this->removeStaleVendors($swcVendorIds);

        return [
            'total_listed' => count($swcVendorIds),
            'synced' => $synced,
            'failed' => $failed,
            'removed' => $removed,
        ];
    }

    /**
     * @return array<int, array{id:int,name:string}>
     */
    protected function pullVendorList(): array
    {
        $startIndex = 1;
        $total = null;
        $items = [];

        do {
            $response = $this->httpClient()
                ->get($this->apiUrl('/market/vendors/'), [
                    'start_index' => $startIndex,
                    'item_count' => self::LIST_PAGE_SIZE,
                ]);

            if (!$response->ok()) {
                throw new \RuntimeException("Market vendor list request failed with status {$response->status()}");
            }

            $body = $response->json('swcapi.vendors', []);
            $total = (int) ($body['attributes']['total'] ?? $total ?? 0);
            $page = $body['vendor'] ?? [];
            $page = isset($page['attributes']) ? [$page] : $page; // single-vendor edge case

            foreach ($page as $vendor) {
                $id = (int) ($vendor['attributes']['id'] ?? 0);
                $name = (string) ($vendor['attributes']['name'] ?? '');
                if ($id > 0) {
                    $items[] = ['id' => $id, 'name' => $name];
                }
            }

            $startIndex += self::LIST_PAGE_SIZE;
        } while ($total > 0 && count($items) < $total);

        return $items;
    }

    /**
     * @param array<int, int> $swcVendorIds
     * @return array<int, array|null> keyed by swc_vendor_id
     */
    protected function pullVendorDetailsPooled(array $swcVendorIds): array
    {
        $results = [];

        foreach (array_chunk($swcVendorIds, self::DETAIL_POOL_SIZE) as $batch) {
            $responses = Http::pool(fn ($pool) => array_map(
                fn (int $id) => $this->poolRequest($pool)->get($this->apiUrl("/market/vendors/{$id}/")),
                $batch
            ));

            foreach ($batch as $index => $swcVendorId) {
                $response = $responses[$index] ?? null;

                if (!$response instanceof Response || !$response->ok()) {
                    Log::warning('Market vendor detail pull failed', [
                        'swc_vendor_id' => $swcVendorId,
                        'status' => $response instanceof Response ? $response->status() : null,
                    ]);
                    $results[$swcVendorId] = null;
                    continue;
                }

                $results[$swcVendorId] = $response->json('swcapi.vendor');
            }
        }

        return $results;
    }

    protected function poolRequest($pool)
    {
        $ua = (string) Config::get('swc.http_user_agent', 'JOE API Client');

        return $pool->withHeaders([
            'User-Agent' => $ua,
            'Accept' => 'application/json',
        ])->timeout(20);
    }

    protected function httpClient()
    {
        return SwcHttp::make();
    }

    protected function apiUrl(string $path): string
    {
        $base = rtrim((string) Config::get('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');

        return $base . '/' . ltrim($path, '/');
    }

    protected function upsertVendor(array $detail): void
    {
        $swcVendorId = (int) ($detail['id'] ?? 0);
        if ($swcVendorId <= 0) {
            return;
        }

        $owner = $detail['owner'] ?? [];
        $shopkeeper = $detail['shopkeeper'] ?? [];
        $location = $detail['location'] ?? [];
        $sector = $location['sector'] ?? [];
        $system = $location['system'] ?? [];
        // The building/ship/station the vendor actually sits in (e.g. "Nimban Starport",
        // "Mezerel, The Pearl of Phelleem") — this is what members recognize a hub by,
        // not the system name, so it's what hub grouping/display uses.
        $container = $location['container'] ?? [];
        // Planet/city are the "where in system" / "where on the ground" context that a
        // member needs once they've already reached the right galaxy grid — empty for
        // deep-space and station/ship vendors, populated for planetside ones.
        $planet = $location['planet'] ?? [];
        $city = $location['city'] ?? [];
        $galaxyCoords = $location['coordinates']['galaxy']['attributes'] ?? [];
        $systemCoords = $location['coordinates']['system']['attributes'] ?? [];
        $surfaceCoords = $location['coordinates']['surface']['attributes'] ?? [];
        $groundCoords = $location['coordinates']['ground']['attributes'] ?? [];

        DB::transaction(function () use (
            $detail, $swcVendorId, $owner, $shopkeeper, $sector, $system, $container,
            $planet, $city, $galaxyCoords, $systemCoords, $surfaceCoords, $groundCoords
        ) {
            $vendor = SwcMarketVendor::query()->updateOrCreate(
                ['swc_vendor_id' => $swcVendorId],
                [
                    'name' => (string) ($detail['name'] ?? ''),
                    'description' => $detail['description'] ?? null,
                    'owner_uid' => $owner['attributes']['uid'] ?? null,
                    'owner_label' => $owner['value'] ?? null,
                    'shopkeeper_uid' => $shopkeeper['uid'] ?? null,
                    'shopkeeper_name' => $shopkeeper['name'] ?? null,
                    'sector_uid' => $sector['attributes']['uid'] ?? null,
                    'sector_label' => $sector['value'] ?? null,
                    'system_uid' => $system['attributes']['uid'] ?? null,
                    'system_label' => $system['value'] ?? null,
                    'container_uid' => $container['attributes']['uid'] ?? null,
                    'container_type' => $container['attributes']['type'] ?? null,
                    'container_label' => $container['value'] ?? null,
                    'planet_uid' => $planet['attributes']['uid'] ?? null,
                    'planet_label' => $planet['value'] ?? null,
                    'city_uid' => $city['attributes']['uid'] ?? null,
                    'city_label' => $city['value'] ?? null,
                    'galx' => isset($galaxyCoords['x']) ? (int) $galaxyCoords['x'] : null,
                    'galy' => isset($galaxyCoords['y']) ? (int) $galaxyCoords['y'] : null,
                    'system_x' => isset($systemCoords['x']) ? (int) $systemCoords['x'] : null,
                    'system_y' => isset($systemCoords['y']) ? (int) $systemCoords['y'] : null,
                    'surface_x' => isset($surfaceCoords['x']) ? (int) $surfaceCoords['x'] : null,
                    'surface_y' => isset($surfaceCoords['y']) ? (int) $surfaceCoords['y'] : null,
                    'ground_x' => isset($groundCoords['x']) ? (int) $groundCoords['x'] : null,
                    'ground_y' => isset($groundCoords['y']) ? (int) $groundCoords['y'] : null,
                    'last_synced_at' => now(),
                ]
            );

            $wares = $detail['wares']['ware'] ?? [];
            $wares = isset($wares['name']) ? [$wares] : $wares; // single-ware edge case

            $vendor->listings()->delete();

            $rows = [];
            $now = now();

            foreach ($wares as $ware) {
                $wareName = trim((string) ($ware['type'] ?? $ware['name'] ?? ''));
                if ($wareName === '') {
                    continue;
                }

                $match = $this->matchEntity($wareName);

                $rows[] = [
                    'vendor_id' => $vendor->id,
                    'ware_name' => $wareName,
                    'matched_item_type_uid' => $match['uid'],
                    'matched_entity_type' => $match['type'],
                    'quantity' => (int) ($ware['quantity'] ?? 0),
                    'price' => (int) ($ware['price'] ?? 0),
                    'currency' => (string) ($ware['currency'] ?? 'credits'),
                    'image_small' => $ware['images']['small'] ?? null,
                    'image_large' => $ware['images']['large'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if ($rows !== []) {
                SwcMarketVendorListing::query()->insert($rows);
            }
        });
    }

    /**
     * @return array{uid: ?string, type: ?string}
     */
    protected function matchEntity(string $wareName): array
    {
        static $caches = null;

        if ($caches === null) {
            $caches = [];
            foreach ($this->matchableTypeModels() as $entityType => $modelClass) {
                $caches[$entityType] = $modelClass::query()
                    ->pluck('uid', 'name')
                    ->mapWithKeys(fn ($uid, $name) => [mb_strtolower(trim((string) $name)) => $uid])
                    ->all();
            }
        }

        $key = mb_strtolower($wareName);

        foreach ($caches as $entityType => $cache) {
            if (isset($cache[$key])) {
                return ['uid' => $cache[$key], 'type' => $entityType];
            }
        }

        return ['uid' => null, 'type' => null];
    }

    /**
     * @return array<string, class-string>
     */
    protected function matchableTypeModels(): array
    {
        return [
            'item' => SwcItemType::class,
            'droid' => SwcDroidType::class,
            'weapon' => SwcWeaponType::class,
            'material' => SwcMaterialType::class,
            'vehicle' => SwcVehicleType::class,
            'ship' => SwcShipType::class,
            'creature' => SwcCreatureType::class,
        ];
    }

    protected function removeStaleVendors(array $currentSwcVendorIds): int
    {
        if ($currentSwcVendorIds === []) {
            return 0;
        }

        return SwcMarketVendor::query()
            ->whereNotIn('swc_vendor_id', $currentSwcVendorIds)
            ->delete();
    }
}
