<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\MarketListing;
use App\Support\Market\MarketWatermarkService;
use App\Support\Swc\SwcInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FactionStoreController extends Controller
{
    public function __construct(
        protected SwcInventoryService $swcInventoryService,
        protected MarketInventoryController $marketInventoryController,
        protected MarketWatermarkService $watermark,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $entityType = $request->query('entity_type');

        $query = MarketListing::query()
            ->with(['listedBy', 'sellerFaction'])
            ->where('channel', MarketListing::CHANNEL_FACTION_STORE)
            ->where('status', MarketListing::STATUS_OPEN)
            ->orderByDesc('id');
        $query->visibleToUser($user);

        if ($entityType) {
            $query->where('entity_type', $entityType);
        }

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

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->is_admin && !$user->is_joe_member) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'faction_id' => ['required', 'integer', 'exists:factions,id'],
            'entity_type' => ['required', 'string', 'max:32'],
            'entity_uid' => ['required', 'string', 'max:64'],
            'entity_name' => ['required', 'string', 'max:255'],
            'entity_type_uid' => ['nullable', 'string', 'max:64'],
            'location_galx' => ['nullable', 'integer'],
            'location_galy' => ['nullable', 'integer'],
            'location_label' => ['nullable', 'string', 'max:255'],
            'price_credits' => ['required', 'integer', 'min:1'],
            'quantity_total' => ['required', 'integer', 'min:1'],
            'audience' => ['nullable', 'in:public,joe_members'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'image_watermarked' => ['nullable', 'boolean'],
        ]);

        $faction = Faction::findOrFail($validated['faction_id']);

        $token = $this->swcInventoryService->resolveAccessTokenForUser($user);

        if (!$token) {
            return response()->json(['ok' => false, 'message' => 'No SWC access token. Please sync Market (Faction Store) access first.'], 422);
        }

        // Tag the entity as a faction store listing
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
            SwcInventoryService::TAG_FACTION_STORE
        );

        if (!$tagResult['ok']) {
            return response()->json([
                'ok' => false,
                'message' => 'Failed to tag entity in SWC. Ensure you have faction inventory access.',
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
            'channel' => MarketListing::CHANNEL_FACTION_STORE,
            'audience' => $validated['audience'] ?? MarketListing::AUDIENCE_PUBLIC,
            'seller_type' => 'faction',
            'seller_id' => $faction->id,
            'entity_type' => $validated['entity_type'],
            'entity_uid' => $validated['entity_uid'],
            'entity_name' => $normalizedEntityName,
            'entity_type_uid' => $validated['entity_type_uid'] ?? $snapshot['type_uid'] ?? null,
            'location_galx' => $validated['location_galx'] ?? $snapshot['location']['galx'] ?? null,
            'location_galy' => $validated['location_galy'] ?? $snapshot['location']['galy'] ?? null,
            'location_label' => $validated['location_label'] ?? $snapshot['location']['system'] ?? null,
            'price_credits' => $validated['price_credits'],
            'quantity_total' => $requestedQuantity,
            'notes' => $validated['notes'] ?? null,
            'image_watermarked' => $applyWatermark,
            'status' => MarketListing::STATUS_OPEN,
            'listed_by_user_id' => $user->id,
            'entity_image_url' => $watermarkedImgUrl ?? $entityImageUrl,
            'entity_snapshot' => $snapshot ?: null,
        ]);

        return response()->json(['ok' => true, 'data' => $this->formatListing($listing)], 201);
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
            'image_watermarked' => (bool) $listing->image_watermarked,
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
}
