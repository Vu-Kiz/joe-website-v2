<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\MarketListing;
use App\Support\Market\MarketReservationService;
use App\Support\Market\MarketWatermarkService;
use App\Support\Swc\SwcInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketListingController extends Controller
{
    public function __construct(
        protected SwcInventoryService $swcInventoryService,
        protected MarketReservationService $marketReservationService,
        protected MarketInventoryController $marketInventoryController,
        protected MarketWatermarkService $watermark,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $channels = $this->parseCsvFilter($request->query('channel'));
        $entityTypes = $this->parseCsvFilter($request->query('entity_type'));
        $saleTypes = $this->parseCsvFilter($request->query('sale_type'));
        $status = $request->query('status', MarketListing::STATUS_OPEN);

        $query = MarketListing::query()->with(['listedBy', 'sellerFaction']);
        $query->visibleToUser($user);

        if ($channels !== []) {
            $query->whereIn('channel', $channels);
        }

        if ($entityTypes !== []) {
            $this->applyEntityTypeFilter($query, $entityTypes);
        }

        if ($saleTypes !== []) {
            $query->whereIn('sale_type', $saleTypes);
        }

        $query->where('status', $status);
        $query->where(function ($subQuery) use ($user) {
            $subQuery
                ->where('channel', MarketListing::CHANNEL_FACTION_STORE)
                ->orWhere('listed_by_user_id', '!=', $user->id);
        });
        $query->orderByDesc('id');

        $listings = $query->paginate(50);

        return response()->json([
            'ok' => true,
            'data' => $listings->map(fn ($l) => $this->formatListing($l)),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page' => $listings->lastPage(),
                'total' => $listings->total(),
            ],
        ]);
    }

    public function show(MarketListing $marketListing): JsonResponse
    {
        if (!$marketListing->isVisibleTo($request->user())) {
            abort(404);
        }

        $marketListing->load(['listedBy', 'sellerFaction']);

        return response()->json([
            'ok' => true,
            'data' => $this->formatListing($marketListing),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $saleType = $request->input('sale_type', 'standard');

        if ($saleType === 'custom') {
            return $this->storeCustom($request, $user);
        }

        if ($saleType === 'bundle') {
            return $this->storeBundle($request, $user);
        }

        return $this->storeStandard($request, $user);
    }

    protected function storeBundle(Request $request, $user): JsonResponse
    {
        $validated = $request->validate([
            'bundle_name'      => ['required', 'string', 'max:255'],
            'notes'            => ['nullable', 'string', 'max:2000'],
            'image_watermarked' => ['nullable', 'boolean'],
            'audience'         => ['nullable', 'in:public,joe_members'],
            'faction_id'       => ['nullable', 'integer', 'exists:factions,id'],
            'items'            => ['required', 'array', 'min:2'],
            'items.*.entity_type' => ['required', 'string', 'max:32'],
            'items.*.entity_uid'  => ['required', 'string', 'max:64'],
            'items.*.entity_name' => ['required', 'string', 'max:255'],
            'items.*.price_credits' => ['required', 'integer', 'min:0'],
            'items.*.quantity_total' => ['nullable', 'integer', 'min:1'],
        ]);

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);
        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token.'], 422);
        }

        $applyWatermark = (bool) ($validated['image_watermarked'] ?? false);
        $bundleItems    = [];
        $totalPrice     = 0;
        $factionId      = $validated['faction_id'] ?? null;
        $tag            = $factionId ? SwcInventoryService::TAG_FACTION_STORE : SwcInventoryService::TAG_MEMBER_LISTING;

        foreach ($validated['items'] as $item) {
            $snapshot = $this->marketInventoryController->snapshotEntity($token, $item['entity_type'], $item['entity_uid']);
            $normalizedEntityName = $this->normalizeEntityName($item['entity_name']);
            $requestedQuantity = (int) ($item['quantity_total'] ?? 1);

            if ($this->isMaterialType($item['entity_type'])) {
                $availableQuantity = (int) ($snapshot['quantity'] ?? 0);
                if ($availableQuantity <= 0 || $requestedQuantity > $availableQuantity) {
                    return response()->json([
                        'ok' => false,
                        'message' => "{$normalizedEntityName} only has " . number_format($availableQuantity) . " available in the pile.",
                    ], 422);
                }
            }

            $tagResult = $this->swcInventoryService->applyTag($token, $item['entity_type'], $item['entity_uid'], $tag);
            if (!$tagResult['ok']) {
                return response()->json(['ok' => false, 'message' => "Failed to tag {$normalizedEntityName} in SWC."], 422);
            }

            $imageUrl = $snapshot['image_url'] ?? null;
            if ($applyWatermark && $imageUrl) {
                $imageUrl = $this->watermark->watermarkFromUrl($imageUrl) ?? $imageUrl;
            }

            $bundleItems[] = [
                'entity_type'   => $item['entity_type'],
                'entity_uid'    => $item['entity_uid'],
                'entity_name'   => $normalizedEntityName,
                'type_name'     => $snapshot['type_name'] ?? null,
                'price_credits' => $item['price_credits'],
                'quantity_total' => $requestedQuantity,
                'entity_image_url' => $imageUrl,
                'type_uid'      => $snapshot['type_uid'] ?? null,
            ];

            $totalPrice += $item['price_credits'] * $requestedQuantity;
        }

        $listing = MarketListing::create([
            'sale_type'       => 'bundle',
            'channel'         => $factionId ? MarketListing::CHANNEL_FACTION_STORE : MarketListing::CHANNEL_MEMBER,
            'audience'        => $this->resolveAudience($validated['audience'] ?? null),
            'seller_type'     => $factionId ? 'faction' : 'user',
            'seller_id'       => $factionId ?? $user->id,
            'status'          => MarketListing::STATUS_OPEN,
            'listed_by_user_id' => $user->id,
            'entity_type'     => 'bundle',
            'entity_uid'      => 'bundle-' . uniqid(),
            'entity_name'     => $validated['bundle_name'],
            'price_credits'   => $totalPrice,
            'quantity_total'  => 1,
            'notes'           => $validated['notes'] ?? null,
            'image_watermarked' => $applyWatermark,
            'bundle_items'    => $bundleItems,
            'entity_image_url' => $bundleItems[0]['entity_image_url'] ?? null,
        ]);

        return response()->json(['ok' => true, 'data' => $this->formatListing($listing)], 201);
    }

    protected function storeStandard(Request $request, $user): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => ['required', 'string', 'max:32'],
            'entity_uid' => ['required', 'string', 'max:64'],
            'entity_name' => ['required', 'string', 'max:255'],
            'entity_type_uid' => ['nullable', 'string', 'max:64'],
            'location_galx' => ['nullable', 'integer'],
            'location_galy' => ['nullable', 'integer'],
            'location_label' => ['nullable', 'string', 'max:255'],
            'price_credits' => ['required', 'integer', 'min:1'],
            'quantity_total' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'image_watermarked' => ['nullable', 'boolean'],
            'audience' => ['nullable', 'in:public,joe_members'],
        ]);

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);

        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token. Please sync Market (Personal Inventory) access first.'], 422);
        }

        $snapshot = $this->marketInventoryController->snapshotEntity($token, $validated['entity_type'], $validated['entity_uid']);
        $requestedQuantity = (int) $validated['quantity_total'];
        $normalizedEntityName = $this->normalizeEntityName($validated['entity_name']);

        if ($this->isMaterialType($validated['entity_type'])) {
            $availableQuantity = (int) ($snapshot['quantity'] ?? 0);
            if ($availableQuantity <= 0 || $requestedQuantity > $availableQuantity) {
                return response()->json([
                    'ok' => false,
                    'message' => "{$normalizedEntityName} only has " . number_format($availableQuantity) . " available in the pile.",
                ], 422);
            }
        }

        $tagResult = $this->swcInventoryService->applyTag(
            $token,
            $validated['entity_type'],
            $validated['entity_uid'],
            SwcInventoryService::TAG_MEMBER_LISTING
        );

        if (!$tagResult['ok']) {
            return response()->json([
                'ok' => false,
                'message' => 'Failed to tag entity in SWC. Ensure you own this entity and have granted inventory access.',
                'swc_status' => $tagResult['status'],
            ], 422);
        }

        $entityImageUrl    = $snapshot['image_url'] ?? null;
        $applyWatermark    = (bool) ($validated['image_watermarked'] ?? false);
        $watermarkedImgUrl = null;

        if ($applyWatermark && $entityImageUrl) {
            $watermarkedImgUrl = $this->watermark->watermarkFromUrl($entityImageUrl);
        }

        $listing = MarketListing::create([
            ...$validated,
            'sale_type' => 'standard',
            'channel' => MarketListing::CHANNEL_MEMBER,
            'audience' => $this->resolveAudience($validated['audience'] ?? null),
            'seller_type' => 'user',
            'seller_id' => $user->id,
            'status' => MarketListing::STATUS_OPEN,
            'listed_by_user_id' => $user->id,
            'entity_name' => $normalizedEntityName,
            'quantity_total' => $requestedQuantity,
            'image_watermarked' => $applyWatermark,
            'entity_type_uid' => $validated['entity_type_uid'] ?? $snapshot['type_uid'] ?? null,
            'location_galx' => $validated['location_galx'] ?? $snapshot['location']['galx'] ?? null,
            'location_galy' => $validated['location_galy'] ?? $snapshot['location']['galy'] ?? null,
            'location_label' => $validated['location_label'] ?? $snapshot['location']['system'] ?? null,
            'entity_image_url' => $watermarkedImgUrl ?? $entityImageUrl,
            'entity_snapshot' => $snapshot ?: null,
        ]);

        return response()->json(['ok' => true, 'data' => $this->formatListing($listing)], 201);
    }

    protected function storeCustom(Request $request, $user): JsonResponse
    {
        $validated = $request->validate([
            'price_credits'         => ['required', 'integer', 'min:1'],
            'notes'                 => ['nullable', 'string', 'max:2000'],
            'custom_image_path'     => ['required', 'string', 'max:512'],
            'custom_image_watermarked_path' => ['required', 'string', 'max:512'],
            'custom_entity_category' => ['required', 'string', 'max:50'],
            'custom_entity_uid'     => ['required', 'string', 'max:100'],
            'custom_entity_name'    => ['required', 'string', 'max:255'],
            'custom_entity_image_url' => ['nullable', 'string', 'max:512'],
            'faction_id'            => ['nullable', 'integer', 'exists:factions,id'],
            'is_unlimited'          => ['nullable', 'boolean'],
            'quantity_total'        => ['nullable', 'integer', 'min:1'],
            'audience'              => ['nullable', 'in:public,joe_members'],
        ]);

        $factionId  = $validated['faction_id'] ?? null;
        $sellerType = $factionId ? 'faction' : 'user';
        $sellerId   = $factionId ?? $user->id;
        $channel    = $factionId ? MarketListing::CHANNEL_FACTION_STORE : MarketListing::CHANNEL_MEMBER;
        $audience   = $this->resolveAudience($validated['audience'] ?? null);
        $unlimited  = (bool) ($validated['is_unlimited'] ?? true);
        $qty        = $unlimited ? 9999999 : (int) ($validated['quantity_total'] ?? 1);

        $listing = MarketListing::create([
            'price_credits'                 => $validated['price_credits'],
            'notes'                         => $validated['notes'] ?? null,
            'custom_image_path'             => $validated['custom_image_path'],
            'custom_image_watermarked_path' => $validated['custom_image_watermarked_path'],
            'custom_entity_category'        => $validated['custom_entity_category'],
            'custom_entity_uid'             => $validated['custom_entity_uid'],
            'custom_entity_name'            => $this->normalizeEntityName($validated['custom_entity_name']),
            'custom_entity_image_url'       => $validated['custom_entity_image_url'] ?? null,
            'sale_type'                     => 'custom',
            'channel'                       => $channel,
            'audience'                      => $audience,
            'seller_type'                   => $sellerType,
            'seller_id'                     => $sellerId,
            'status'                        => MarketListing::STATUS_OPEN,
            'listed_by_user_id'             => $user->id,
            'is_unlimited'                  => $unlimited,
            'quantity_total'                => $qty,
            'entity_type'                   => $validated['custom_entity_category'],
            'entity_uid'                    => '',
            'entity_name'                   => $this->normalizeEntityName($validated['custom_entity_name']),
        ]);

        return response()->json(['ok' => true, 'data' => $this->formatListing($listing)], 201);
    }

    public function cancel(Request $request, MarketListing $marketListing): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketListing->listed_by_user_id !== (int) $user->id && !$user->is_admin) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        if (!in_array($marketListing->status, [MarketListing::STATUS_OPEN, MarketListing::STATUS_RESERVED], true)) {
            return response()->json(['ok' => false, 'message' => 'Listing cannot be cancelled in its current state.'], 422);
        }

        $hasActivePayment = $marketListing->orders()
            ->whereIn('status', [
                \App\Models\MarketOrder::STATUS_PAID,
                \App\Models\MarketOrder::STATUS_TRANSFER_PENDING,
                \App\Models\MarketOrder::STATUS_DISPUTED,
            ])
            ->exists();

        if ($hasActivePayment) {
            return response()->json(['ok' => false, 'message' => 'This listing has a paid order in progress and cannot be cancelled.'], 422);
        }

        $marketListing->status = MarketListing::STATUS_CANCELLED;
        $marketListing->save();

        // Best-effort tag removal
        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);
        if ($token) {
            $tag = $marketListing->channel === MarketListing::CHANNEL_FACTION_STORE
                ? SwcInventoryService::TAG_FACTION_STORE
                : SwcInventoryService::TAG_MEMBER_LISTING;

            if ($marketListing->sale_type === 'bundle' && is_array($marketListing->bundle_items)) {
                foreach ($marketListing->bundle_items as $item) {
                    if (!empty($item['entity_type']) && !empty($item['entity_uid'])) {
                        $this->swcInventoryService->removeTag($token, $item['entity_type'], $item['entity_uid'], $tag);
                    }
                }
            } else {
                $this->swcInventoryService->removeTag($token, $marketListing->entity_type, $marketListing->entity_uid, $tag);
            }
        }

        return response()->json(['ok' => true]);
    }

    public function myListings(Request $request): JsonResponse
    {
        $user = $request->user();

        $listings = MarketListing::query()
            ->with(['listedBy', 'sellerFaction'])
            ->where('listed_by_user_id', $user->id)
            ->whereNotIn('status', [MarketListing::STATUS_COMPLETED, MarketListing::STATUS_CANCELLED])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $listings->map(fn ($l) => $this->formatListing($l)),
        ]);
    }

    protected function formatListing(MarketListing $listing): array
    {
        return [
            'id' => $listing->id,
            'channel' => $listing->channel,
            'audience' => $listing->audience ?? MarketListing::AUDIENCE_PUBLIC,
            'seller_type' => $listing->seller_type,
            'seller_id' => $listing->seller_id,
            'entity_type' => $listing->entity_type,
            'entity_uid' => $listing->entity_uid,
            'entity_name' => $listing->entity_name,
            'entity_type_uid' => $listing->entity_type_uid,
            'location_galx' => $listing->location_galx,
            'location_galy' => $listing->location_galy,
            'location_label' => $listing->location_label,
            'price_credits' => $listing->price_credits,
            'quantity_total' => $listing->quantity_total,
            'quantity_reserved' => $listing->quantity_reserved,
            'quantity_sold' => $listing->quantity_sold,
            'quantity_available' => $listing->quantity_available,
            'notes' => $listing->notes,
            'status' => $listing->status,
            'seller_name' => $this->resolveSellerName($listing),
            'listed_by' => $listing->listedBy ? [
                'id' => $listing->listedBy->id,
                'handle' => $listing->listedBy->handle ?? $listing->listedBy->swc_handle,
            ] : null,
            'entity_image_url' => $listing->entity_image_url ?? $this->derivedImageUrl($listing),
            'entity_snapshot' => $listing->entity_snapshot,
            'sale_type' => $listing->sale_type ?? 'standard',
            'is_unlimited' => (bool) $listing->is_unlimited,
            'image_watermarked' => (bool) $listing->image_watermarked,
            'custom_image_url' => $listing->custom_image_watermarked_path
                ? rtrim(env('BACKEND_STORAGE_URL', config('app.url') . '/storage'), '/') . '/' . $listing->custom_image_watermarked_path
                : null,
            'custom_entity_category' => $listing->custom_entity_category,
            'custom_entity_uid' => $listing->custom_entity_uid,
            'custom_entity_name' => $listing->custom_entity_name,
            'custom_entity_image_url' => $listing->custom_entity_image_url,
            'bundle_items' => $listing->bundle_items,
            'created_at' => $listing->created_at?->toIso8601String(),
        ];
    }

    private function derivedImageUrl(MarketListing $listing): ?string
    {
        $typeUid = $listing->entity_type_uid;
        if (!$typeUid) return null;

        $num = preg_replace('/^\d+:/', '', $typeUid);

        return match ($listing->entity_type) {
            'material' => "https://images.swcombine.com//materials/{$num}/main.png",
            'station'  => "https://images.swcombine.com//stations/{$num}/small.gif",
            default    => null,
        };
    }

    private function resolveAudience(?string $audience): string
    {
        return $audience === MarketListing::AUDIENCE_JOE_MEMBERS
            ? MarketListing::AUDIENCE_JOE_MEMBERS
            : MarketListing::AUDIENCE_PUBLIC;
    }

    private function isMaterialType(string $entityType): bool
    {
        return strtolower(trim($entityType)) === SwcInventoryService::MATERIAL_TYPE;
    }

    private function normalizeEntityName(?string $name): string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return '';
        }

        return mb_strtoupper(mb_substr($name, 0, 1)) . mb_substr($name, 1);
    }

    private function resolveSellerName(MarketListing $listing): ?string
    {
        if ($listing->seller_type === 'faction') {
            return $listing->sellerFaction?->name
                ?? Faction::find($listing->seller_id)?->name
                ?? 'Faction';
        }

        return $listing->listedBy?->handle ?? $listing->listedBy?->swc_handle;
    }

    /**
     * @param array<int, string> $entityTypes
     */
    private function applyEntityTypeFilter($query, array $entityTypes): void
    {
        $query->where(function ($entityQuery) use ($entityTypes) {
            $entityQuery->whereIn('entity_type', $entityTypes);

            foreach ($entityTypes as $entityType) {
                $entityQuery->orWhere(function ($bundleQuery) use ($entityType) {
                    $bundleQuery
                        ->where('sale_type', 'bundle')
                        ->whereRaw(
                            "JSON_SEARCH(bundle_items, 'one', ?, NULL, '$[*].entity_type') IS NOT NULL",
                            [$entityType]
                        );
                });
            }
        });
    }

    /**
     * @return array<int, string>
     */
    private function parseCsvFilter(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (string $part): string => trim($part),
            explode(',', $value)
        )));
    }
}
