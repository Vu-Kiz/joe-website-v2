<?php

declare(strict_types=1);

namespace App\Support\Market;

use App\Models\Market\MarketListing;
use App\Models\Market\MarketListingStock;
use App\Models\Market\MarketOrder;
use Illuminate\Support\Facades\DB;

class MarketReservationService
{
    public const ORDER_TTL_MINUTES = 30;

    public function reserve(MarketListing $listing, int $quantity): MarketOrder
    {
        return DB::transaction(function () use ($listing, $quantity) {
            $listing = MarketListing::lockForUpdate()->findOrFail($listing->id);

            if (!$listing->isAvailable()) {
                throw new \RuntimeException('Listing is not available.');
            }

            if ($quantity > $listing->quantity_available) {
                throw new \RuntimeException('Requested quantity exceeds available stock.');
            }

            $listing->increment('quantity_reserved', $quantity);

            if (!$listing->isMaterial() && $listing->quantity_available === 0) {
                $listing->status = MarketListing::STATUS_RESERVED;
                $listing->save();
            }

            $order = MarketOrder::create([
                'listing_id' => $listing->id,
                'buyer_user_id' => request()->user()->id,
                'quantity' => $quantity,
                'total_credits' => $listing->price_credits * $quantity,
                'status' => MarketOrder::STATUS_PENDING_PAYMENT,
                'expires_at' => now()->addMinutes(self::ORDER_TTL_MINUTES),
            ]);

            // For stock listings, atomically assign a specific entity unit to this order
            if ($listing->isStock()) {
                $unit = MarketListingStock::where('listing_id', $listing->id)
                    ->where('status', MarketListingStock::STATUS_AVAILABLE)
                    ->lockForUpdate()
                    ->first();

                if (!$unit) {
                    throw new \RuntimeException('No available stock unit found.');
                }

                $unit->status   = MarketListingStock::STATUS_RESERVED;
                $unit->order_id = $order->id;
                $unit->save();
            }

            return $order;
        });
    }

    public function cancel(MarketOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $order = MarketOrder::lockForUpdate()->findOrFail($order->id);

            if (!in_array($order->status, [MarketOrder::STATUS_PENDING_PAYMENT], true)) {
                throw new \RuntimeException('Order cannot be cancelled in its current status.');
            }

            $listing = MarketListing::lockForUpdate()->findOrFail($order->listing_id);

            $listing->decrement('quantity_reserved', $order->quantity);

            if ($listing->status === MarketListing::STATUS_RESERVED) {
                $listing->status = MarketListing::STATUS_OPEN;
                $listing->save();
            }

            // Return the reserved stock unit to available
            if ($listing->isStock()) {
                MarketListingStock::where('listing_id', $listing->id)
                    ->where('order_id', $order->id)
                    ->where('status', MarketListingStock::STATUS_RESERVED)
                    ->update(['status' => MarketListingStock::STATUS_AVAILABLE, 'order_id' => null]);
            }

            $order->status = MarketOrder::STATUS_CANCELLED;
            $order->save();
        });
    }

    public function cancelExpiredOrders(): int
    {
        $expired = MarketOrder::query()
            ->where('status', MarketOrder::STATUS_PENDING_PAYMENT)
            ->where('expires_at', '<=', now())
            ->get();

        $count = 0;

        foreach ($expired as $order) {
            try {
                $this->cancel($order);
                $count++;
            } catch (\Throwable) {
                // already cancelled or in a non-cancellable state — skip
            }
        }

        return $count;
    }
}
