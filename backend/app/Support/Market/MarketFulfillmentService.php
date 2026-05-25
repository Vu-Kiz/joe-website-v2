<?php

declare(strict_types=1);

namespace App\Support\Market;

use App\Models\Market\MarketListing;
use App\Models\Market\MarketListingStock;
use App\Models\Market\MarketOrder;
use App\Models\User;
use App\Support\Swc\SwcInventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MarketFulfillmentService
{
    public function __construct(
        protected SwcInventoryService $swcInventoryService
    ) {
    }

    public function markPaid(MarketOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $order = MarketOrder::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== MarketOrder::STATUS_PENDING_PAYMENT) {
                throw new \RuntimeException('Order is not in pending_payment status.');
            }

            $order->status = MarketOrder::STATUS_PAID;
            $order->save();
        });
    }

    public function fulfillOrder(MarketOrder $order, string $sellerAccessToken): array
    {
        $listing = $order->listing;

        DB::transaction(function () use ($order) {
            $order = MarketOrder::lockForUpdate()->findOrFail($order->id);
            if ($order->status !== MarketOrder::STATUS_PAID) {
                throw new \RuntimeException('Order is not in paid status.');
            }
            $order->status = MarketOrder::STATUS_TRANSFER_PENDING;
            $order->save();
        });

        if ($listing->isMaterial()) {
            // Materials require manual transfer — just mark transfer_pending and notify seller
            return ['ok' => true, 'manual' => true];
        }

        $buyer = $order->buyer;
        $buyerUid = '1:' . $buyer->swc_character_id;
        $reason = 'JOE Internal Market - ' . $order->order_reference;

        // For stock listings, transfer the specific assigned unit
        $transferEntityUid  = $listing->entity_uid;
        $transferEntityType = $listing->entity_type;
        $stockUnit          = null;

        if ($listing->isStock()) {
            $stockUnit = MarketListingStock::where('listing_id', $listing->id)
                ->where('order_id', $order->id)
                ->where('status', MarketListingStock::STATUS_RESERVED)
                ->first();

            if (!$stockUnit) {
                throw new \RuntimeException('No stock unit assigned to this order.');
            }

            $transferEntityUid  = $stockUnit->entity_uid;
            $transferEntityType = $stockUnit->entity_type;
        }

        $result = $this->swcInventoryService->transferOwnership(
            $sellerAccessToken,
            $transferEntityType,
            $transferEntityUid,
            $buyerUid,
            $reason
        );

        DB::transaction(function () use ($order, $listing, $result, $stockUnit) {
            $order = MarketOrder::lockForUpdate()->findOrFail($order->id);
            $order->swc_transfer_result = json_encode($result);

            if ($result['ok']) {
                $order->status = MarketOrder::STATUS_COMPLETED;
                $order->completed_at = now();
                $order->save();

                $listing = MarketListing::lockForUpdate()->findOrFail($listing->id);
                $listing->increment('quantity_sold', $order->quantity);
                $listing->decrement('quantity_reserved', $order->quantity);

                // Stock listings stay open until all units are sold
                if ($listing->isStock()) {
                    if ($listing->quantity_available === 0 && $listing->quantity_reserved === 0) {
                        $listing->status = MarketListing::STATUS_COMPLETED;
                    }
                } else {
                    $listing->status = MarketListing::STATUS_COMPLETED;
                }
                $listing->save();

                // Mark the stock unit as sold
                if ($stockUnit) {
                    $stockUnit->status  = MarketListingStock::STATUS_SOLD;
                    $stockUnit->sold_at = now();
                    $stockUnit->save();
                }

                // Remove the market tag from the transferred entity only
                $this->removeListingTag($listing, $stockUnit?->entity_uid, $stockUnit?->entity_type);
            } else {
                $order->status = MarketOrder::STATUS_DISPUTED;
                $order->dispute_note = 'SWC ownership transfer failed: ' . $this->extractSwcError($result);
                $order->save();

                Log::error('Market ownership transfer failed', [
                    'order_id'   => $order->id,
                    'listing_id' => $listing->id,
                    'entity_uid' => $transferEntityUid,
                    'result'     => $result,
                ]);
            }
        });

        $result['swc_error'] = $result['ok'] ? null : $this->extractSwcError($result);

        return $result;
    }

    public function completeMaterialOrder(MarketOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $order = MarketOrder::lockForUpdate()->findOrFail($order->id);

            if (!in_array($order->status, [MarketOrder::STATUS_TRANSFER_PENDING, MarketOrder::STATUS_DISPUTED], true)) {
                throw new \RuntimeException('Order cannot be completed from its current status.');
            }

            $listing = MarketListing::lockForUpdate()->findOrFail($order->listing_id);

            $order->status = MarketOrder::STATUS_COMPLETED;
            $order->completed_at = now();
            $order->save();

            $listing->increment('quantity_sold', $order->quantity);
            $listing->decrement('quantity_reserved', $order->quantity);

            if ($listing->quantity_available === 0 && $listing->quantity_reserved === 0) {
                $listing->status = MarketListing::STATUS_COMPLETED;
                $listing->save();
                $this->removeListingTag($listing);
            }
        });
    }

    protected function removeListingTag(MarketListing $listing, ?string $entityUidOverride = null, ?string $entityTypeOverride = null): void
    {
        // Best-effort tag removal — logged on failure but does not block completion
        try {
            $sellerToken = $this->resolveSellerToken($listing);
            if (!$sellerToken) {
                return;
            }

            $tag        = $listing->channel === MarketListing::CHANNEL_FACTION_STORE
                ? SwcInventoryService::TAG_FACTION_STORE
                : SwcInventoryService::TAG_MEMBER_LISTING;
            $entityUid  = $entityUidOverride  ?? $listing->entity_uid;
            $entityType = $entityTypeOverride ?? $listing->entity_type;

            $this->swcInventoryService->removeTag($sellerToken, $entityType, $entityUid, $tag);
        } catch (\Throwable $e) {
            Log::warning('Failed to remove market tag from entity', [
                'listing_id' => $listing->id,
                'entity_uid' => $entityUidOverride ?? $listing->entity_uid,
                'message'    => $e->getMessage(),
            ]);
        }
    }

    protected function extractSwcError(array $result): string
    {
        // Try parsed JSON first
        $json = $result['json'] ?? null;
        if (is_array($json)) {
            $msg = $json['swcapi']['error_message']
                ?? $json['error_message']
                ?? null;
            if ($msg) {
                return (string) $msg;
            }
        }

        // Fall back to raw body, trimmed
        $body = $result['body'] ?? null;
        if ($body) {
            // Try to decode if it's JSON
            $decoded = json_decode($body, true);
            if (is_array($decoded)) {
                $msg = $decoded['swcapi']['error_message']
                    ?? $decoded['error_message']
                    ?? null;
                if ($msg) {
                    return (string) $msg;
                }
            }
            return (string) $body;
        }

        return 'Unknown error (HTTP ' . ($result['status'] ?? '?') . ')';
    }

    public function resolveSellerTokenPublic(MarketListing $listing): ?string
    {
        return $this->resolveSellerToken($listing);
    }

    protected function resolveSellerToken(MarketListing $listing): ?string
    {
        if ($listing->seller_type === 'user') {
            $seller = User::find($listing->seller_id);
            if (!$seller) {
                return null;
            }
            return $this->swcInventoryService->resolveAccessTokenForUser($seller);
        }

        // For faction store, use the listed_by user's token (they must have faction inv access)
        $listedBy = $listing->listedBy;
        if (!$listedBy) {
            return null;
        }
        return $this->swcInventoryService->resolveAccessTokenForUser($listedBy);
    }
}
