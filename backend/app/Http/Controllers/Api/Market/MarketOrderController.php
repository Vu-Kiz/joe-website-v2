<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use App\Models\MarketListing;
use App\Models\MarketOrder;
use App\Models\PaymentTransfer;
use App\Support\Market\MarketFulfillmentService;
use App\Support\Market\MarketPaymentService;
use App\Support\Discord\DiscordNotifier;
use App\Support\Market\MarketReservationService;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcCreditTransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketOrderController extends Controller
{
    public function __construct(
        protected MarketReservationService $marketReservationService,
        protected MarketPaymentService $marketPaymentService,
        protected MarketFulfillmentService $marketFulfillmentService,
        protected SwcCreditTransferService $swcCreditTransferService,
        protected SwcAuthorizationService $swcAuthorizationService,
        protected DiscordNotifier $discordNotifier,
    ) {
    }

    public function store(Request $request, MarketListing $marketListing): JsonResponse
    {
        if (!$marketListing->isVisibleTo($request->user())) {
            abort(404);
        }

        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $order = $this->marketReservationService->reserve($marketListing, $validated['quantity']);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        $transfer = $this->marketPaymentService->buildPaymentTransfer($order);

        return response()->json([
            'ok' => true,
            'data' => $this->formatOrder($order->fresh(['listing'])),
            'payment' => [
                'transfer_id' => $transfer->id,
                'payee_handle' => $transfer->payee_handle,
                'payee_swc_uid' => $transfer->payee_swc_uid,
                'amount' => $transfer->total_amount,
                'reference' => $transfer->communication,
            ],
        ], 201);
    }

    public function show(MarketOrder $marketOrder): JsonResponse
    {
        $marketOrder->load('listing', 'buyer');

        return response()->json([
            'ok' => true,
            'data' => $this->formatOrder($marketOrder),
        ]);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $user = $request->user();

        $orders = MarketOrder::query()
            ->where('buyer_user_id', $user->id)
            ->whereNotIn('status', [MarketOrder::STATUS_CANCELLED])
            ->with('listing')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $orders->map(fn ($o) => $this->formatOrder($o)),
        ]);
    }

    public function cancel(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketOrder->buyer_user_id !== (int) $user->id && !$user->is_admin) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        try {
            $this->marketReservationService->cancel($marketOrder);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true]);
    }

    public function dispute(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketOrder->buyer_user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:1000'],
        ]);

        if (!in_array($marketOrder->status, [MarketOrder::STATUS_PAID, MarketOrder::STATUS_TRANSFER_PENDING], true)) {
            return response()->json(['ok' => false, 'message' => 'Order cannot be disputed in its current status.'], 422);
        }

        $marketOrder->status = MarketOrder::STATUS_DISPUTED;
        $marketOrder->dispute_note = $validated['note'];
        $marketOrder->save();

        return response()->json(['ok' => true]);
    }

    public function pendingFulfillment(Request $request): JsonResponse
    {
        $user = $request->user();

        $orders = MarketOrder::query()
            ->whereHas('listing', fn ($q) => $q->where('listed_by_user_id', $user->id))
            ->whereIn('status', [MarketOrder::STATUS_PAID, MarketOrder::STATUS_TRANSFER_PENDING, MarketOrder::STATUS_DISPUTED])
            ->with('listing', 'buyer')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $orders->map(fn ($o) => $this->formatOrder($o, true)),
        ]);
    }

    public function fulfill(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketOrder->listing->listed_by_user_id !== (int) $user->id && !$user->is_admin) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($marketOrder->status !== MarketOrder::STATUS_PAID) {
            return response()->json(['ok' => false, 'message' => 'Order is not in paid status.'], 422);
        }

        $sellerToken = $this->marketFulfillmentService->resolveSellerTokenPublic($marketOrder->listing);

        if (!$sellerToken) {
            return response()->json(['ok' => false, 'message' => 'No SWC inventory token found. Ensure Market inventory access is linked.'], 422);
        }

        try {
            $result = $this->marketFulfillmentService->fulfillOrder($marketOrder, $sellerToken);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        if ($result['manual'] ?? false) {
            return response()->json(['ok' => true, 'manual' => true, 'message' => 'Order marked as transfer pending. Send the materials manually in SWC, then confirm when done.']);
        }

        if (!($result['ok'] ?? false)) {
            return response()->json(['ok' => false, 'message' => 'SWC transfer failed: ' . ($result['swc_error'] ?? 'unknown error')], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Transfer complete. Order marked as completed.']);
    }

    public function confirmMaterial(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketOrder->listing->listed_by_user_id !== (int) $user->id && !$user->is_admin) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($marketOrder->status !== MarketOrder::STATUS_TRANSFER_PENDING) {
            return response()->json(['ok' => false, 'message' => 'Order is not in transfer_pending status.'], 422);
        }

        try {
            $this->marketFulfillmentService->completeMaterialOrder($marketOrder);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Order marked as completed.']);
    }

    public function refund(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();
        $marketOrder->load('listing', 'buyer');

        if ((int) $marketOrder->listing->listed_by_user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $refundableStatuses = [
            MarketOrder::STATUS_PAID,
            MarketOrder::STATUS_TRANSFER_PENDING,
            MarketOrder::STATUS_DISPUTED,
        ];

        if (!in_array($marketOrder->status, $refundableStatuses, true)) {
            return response()->json(['ok' => false, 'message' => 'This order cannot be refunded in its current state.'], 422);
        }

        $buyer = $marketOrder->buyer;

        if (!$buyer || !$buyer->swc_handle) {
            return response()->json(['ok' => false, 'message' => 'Buyer SWC handle is missing — refund manually in SWC.'], 422);
        }

        $amount = (int) $marketOrder->total_credits;
        $reference = 'JOE-XFER-' . now()->format('YmdHis') . '-' . random_int(1000, 9999);
        $entityLabel = ucfirst($marketOrder->listing->entity_type) . ' refund: ' . $marketOrder->listing->entity_name;
        $reason = $reference . ' | ' . $entityLabel;

        try {
            $listing = $marketOrder->listing;

            if ($listing->channel === \App\Models\MarketListing::CHANNEL_FACTION_STORE && $listing->seller_type === 'faction') {
                $faction = \App\Models\Faction::find($listing->seller_id);
                if (!$faction || !$faction->swc_uid) {
                    return response()->json(['ok' => false, 'message' => 'Faction SWC UID missing — refund manually in SWC.'], 422);
                }
                $this->swcCreditTransferService->sendFactionCredits(
                    actingUser: $user,
                    factionUid: (string) $faction->swc_uid,
                    recipient: $buyer->swc_handle,
                    amount: $amount,
                    reason: $reason
                );
            } else {
                if (!$user->swc_character_id) {
                    return response()->json(['ok' => false, 'message' => 'Your SWC character ID is missing — refund manually in SWC.'], 422);
                }
                $this->swcCreditTransferService->sendCharacterCredits(
                    actingUser: $user,
                    senderCharacterId: (int) $user->swc_character_id,
                    recipient: $buyer->swc_handle,
                    amount: $amount,
                    reason: $reason
                );
            }
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        // Release reservation and restore listing, then cancel the order
        \Illuminate\Support\Facades\DB::transaction(function () use ($marketOrder) {
            $listing = \App\Models\MarketListing::lockForUpdate()->find($marketOrder->listing_id);

            if ($listing) {
                $listing->decrement('quantity_reserved', $marketOrder->quantity);

                if ($listing->status === \App\Models\MarketListing::STATUS_RESERVED) {
                    $listing->status = \App\Models\MarketListing::STATUS_OPEN;
                    $listing->save();
                }
            }

            $marketOrder->status = \App\Models\MarketOrder::STATUS_CANCELLED;
            $marketOrder->save();
        });

        return response()->json([
            'ok' => true,
            'message' => number_format($amount) . ' Credits refunded to ' . $buyer->swc_handle . '.',
        ]);
    }

    public function retryTransfer(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();
        $marketOrder->load('listing');

        if ((int) $marketOrder->listing->listed_by_user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        if ($marketOrder->status !== MarketOrder::STATUS_DISPUTED) {
            return response()->json(['ok' => false, 'message' => 'Only disputed orders can be retried.'], 422);
        }

        // Reset to paid so fulfillOrder can run its status transition
        $marketOrder->status = MarketOrder::STATUS_PAID;
        $marketOrder->dispute_note = null;
        $marketOrder->save();

        $sellerToken = $this->marketFulfillmentService->resolveSellerTokenPublic($marketOrder->listing);

        if (!$sellerToken) {
            $marketOrder->status = MarketOrder::STATUS_DISPUTED;
            $marketOrder->dispute_note = 'Retry failed: no SWC inventory token found.';
            $marketOrder->save();
            return response()->json(['ok' => false, 'message' => 'No SWC inventory token. Ensure Market inventory access is linked.'], 422);
        }

        try {
            $result = $this->marketFulfillmentService->fulfillOrder($marketOrder, $sellerToken);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        if ($result['manual'] ?? false) {
            return response()->json(['ok' => true, 'manual' => true, 'message' => 'Order is transfer pending. Send the materials manually in SWC, then confirm when done.']);
        }

        if (!($result['ok'] ?? false)) {
            return response()->json(['ok' => false, 'message' => 'SWC transfer failed: ' . ($result['swc_error'] ?? 'unknown error')], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Transfer succeeded. Order completed.']);
    }

    public function markComplete(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();
        $marketOrder->load('listing');

        if ((int) $marketOrder->listing->listed_by_user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $isCustom = ($marketOrder->listing->sale_type ?? 'standard') === 'custom';
        $allowedStatuses = $isCustom
            ? [MarketOrder::STATUS_PAID, MarketOrder::STATUS_DISPUTED, MarketOrder::STATUS_TRANSFER_PENDING]
            : [MarketOrder::STATUS_DISPUTED, MarketOrder::STATUS_TRANSFER_PENDING];

        if (!in_array($marketOrder->status, $allowedStatuses, true)) {
            return response()->json(['ok' => false, 'message' => 'Order cannot be manually completed from its current status.'], 422);
        }

        // Use completeMaterialOrder as it handles quantity/listing status correctly
        try {
            $this->marketFulfillmentService->completeMaterialOrder($marketOrder);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Order marked as complete.']);
    }

    public function pay(Request $request, MarketOrder $marketOrder): JsonResponse
    {
        $user = $request->user();

        if ((int) $marketOrder->buyer_user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Not your order.'], 403);
        }

        if ($marketOrder->status !== MarketOrder::STATUS_PENDING_PAYMENT) {
            return response()->json(['ok' => false, 'message' => 'Order is not awaiting payment.'], 422);
        }

        $transfer = PaymentTransfer::find($marketOrder->payment_transfer_id);

        if (!$transfer) {
            return response()->json(['ok' => false, 'message' => 'Payment transfer not found.'], 422);
        }

        // Check the buyer has a payments OAuth token
        $hasPaymentsAccess = $this->swcAuthorizationService->getAccessToken(
            $user,
            \App\Models\SwcAuthorization::CONTEXT_PAYMENTS
        ) !== null;

        if (!$hasPaymentsAccess) {
            return response()->json([
                'ok' => false,
                'needs_payments_access' => true,
                'message' => 'You need Chain Code Verification (Payments) linked to pay via the API. Link it on your About Me page, or pay manually in SWC using the reference.',
                'reference' => $transfer->communication,
                'payee_handle' => $transfer->payee_handle,
                'amount' => $transfer->total_amount,
            ], 422);
        }

        try {
            $result = $this->swcCreditTransferService->transferForUserContext($user, $transfer);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        // Mark transfer verified
        $transfer->status = 'verified';
        $transfer->verified_at = now();
        if (!empty($result['transaction_id'])) {
            $transfer->verified_transaction_id = $result['transaction_id'];
        }
        $transfer->save();

        // Advance order to paid
        try {
            $this->marketFulfillmentService->markPaid($marketOrder);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        // DM the seller on Discord
        $marketOrder->load('listing.listedBy');
        $seller = $marketOrder->listing?->listedBy ?? null;
        if ($seller && is_string($seller->discord_user_id) && $seller->discord_user_id !== '') {
            $buyerHandle = $user->handle ?? $user->swc_handle ?? 'Unknown';
            $entityName = $marketOrder->listing->entity_name ?? 'Unknown';
            $this->discordNotifier->notifyMarketSale(
                $seller->discord_user_id,
                $buyerHandle,
                $entityName,
                $marketOrder->quantity,
                $marketOrder->total_credits,
                $marketOrder->order_reference,
                $marketOrder->id,
            );
        }

        return response()->json([
            'ok' => true,
            'message' => 'Payment sent. The seller will now transfer your item.',
            'transaction_id' => $result['transaction_id'] ?? null,
        ]);
    }

    protected function formatOrder(MarketOrder $order, bool $includeBuyer = false): array
    {
        return [
            'id' => $order->id,
            'listing_id' => $order->listing_id,
            'buyer_user_id' => $order->buyer_user_id,
            'buyer' => $includeBuyer && $order->relationLoaded('buyer') && $order->buyer ? [
                'id' => $order->buyer->id,
                'handle' => $order->buyer->handle ?? $order->buyer->swc_handle,
            ] : null,
            'quantity' => $order->quantity,
            'total_credits' => $order->total_credits,
            'payment_transfer_id' => $order->payment_transfer_id,
            'status' => $order->status,
            'order_reference' => $order->order_reference,
            'expires_at' => $order->expires_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'dispute_note' => $order->dispute_note,
            'listing' => $order->listing ? [
                'id' => $order->listing->id,
                'entity_name' => $order->listing->entity_name,
                'entity_type' => $order->listing->entity_type,
                'channel' => $order->listing->channel,
                'audience' => $order->listing->audience ?? MarketListing::AUDIENCE_PUBLIC,
                'price_credits' => $order->listing->price_credits,
                'sale_type' => $order->listing->sale_type ?? 'standard',
            ] : null,
        ];
    }
}
