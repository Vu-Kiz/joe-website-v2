<?php

namespace App\Support\Payments;

use App\Models\PaymentItem;
use App\Models\PaymentTransfer;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PaymentTransferBuilder
{
    public function createGroupedTransfers(Collection $items, string $method = 'bulk_copy'): Collection
    {
        $grouped = $items->groupBy(function (PaymentItem $item) {
            return implode(':', [
                $item->payer_subject_type,
                (string) $item->payer_subject_id,
                $item->payee_subject_type,
                (string) $item->payee_subject_id,
                (string) $item->payee_swc_uid,
                (string) $item->payee_handle,
            ]);
        });

        $transfers = collect();

        DB::transaction(function () use ($grouped, $method, &$transfers) {
            foreach ($grouped as $groupItems) {
                /** @var PaymentItem $first */
                $first = $groupItems->first();

                $reference = $this->generateReference();

                $communicationPrefix = $this->resolveCommunicationPrefix($groupItems, $reference);

                $transfer = PaymentTransfer::create([
                    'payer_subject_type' => $first->payer_subject_type,
                    'payer_subject_id' => $first->payer_subject_id,
                    'payer_label' => $first->payer_label,
                    'payee_subject_type' => $first->payee_subject_type,
                    'payee_subject_id' => $first->payee_subject_id,
                    'payee_swc_uid' => $first->payee_swc_uid,
                    'payee_handle' => $first->payee_handle,
                    'payee_label' => $first->payee_label,
                    'total_amount' => (int) $groupItems->sum('total_amount'),
                    'reference' => $reference,
                    'communication' => $communicationPrefix,
                    'payment_method' => $method,
                    'status' => 'draft',
                ]);

                foreach ($groupItems as $item) {
                    $transfer->items()->attach($item->id);
                    $item->update(['status' => 'attached']);
                }

                $transfers->push($transfer->load('items'));
            }
        });

        return $transfers;
    }

    protected function resolveCommunicationPrefix(Collection $groupItems, string $reference): string
    {
        /** @var PaymentItem $first */
        $first = $groupItems->first();

        $meta = is_array($first->meta) ? $first->meta : [];
        $prefix = trim((string) ($meta['communication_prefix'] ?? ''));

        if ($prefix !== '') {
            return $prefix . ' ' . $reference;
        }

        return 'JOE payout ' . $reference;
    }

    protected function generateReference(): string
    {
        return 'JOE-XFER-' . now()->format('YmdHis') . '-' . random_int(1000, 9999);
    }
}