<?php

declare(strict_types=1);

namespace App\Support\Market;

use App\Models\Faction;
use App\Models\Market\MarketListing;
use App\Models\Market\MarketOrder;
use App\Models\Payment\PaymentTransfer;
use App\Models\User;

class MarketPaymentService
{
    public function buildPaymentTransfer(MarketOrder $order): PaymentTransfer
    {
        $listing = $order->listing;
        $buyer = $order->buyer;

        [$payeeUid, $payeeHandle] = $this->resolvePayee($listing);

        $reference = 'JOE-XFER-' . now()->format('YmdHis') . '-' . random_int(1000, 9999);

        $entityLabel = ucfirst($listing->entity_type) . ' sale: ' . $listing->entity_name;
        $communication = $reference . ' | ' . $entityLabel;

        $transfer = PaymentTransfer::create([
            'payer_subject_type' => 'user',
            'payer_subject_id' => $buyer->id,
            'payee_swc_uid' => $payeeUid,
            'payee_handle' => $payeeHandle,
            'total_amount' => $order->total_credits,
            'communication' => $communication,
            'reference' => $reference,
            'status' => 'pending',
        ]);

        $order->payment_transfer_id = $transfer->id;
        $order->save();

        return $transfer;
    }

    protected function resolvePayee(MarketListing $listing): array
    {
        if ($listing->channel === MarketListing::CHANNEL_FACTION_STORE) {
            $faction = Faction::find($listing->seller_id);
            if (!$faction) {
                throw new \RuntimeException('Seller faction not found.');
            }
            return ['20:' . $faction->swc_uid, $faction->name];
        }

        $seller = User::find($listing->seller_id);
        if (!$seller) {
            throw new \RuntimeException('Seller user not found.');
        }

        return ['1:' . $seller->swc_character_id, $seller->swc_handle ?? $seller->handle];
    }
}
