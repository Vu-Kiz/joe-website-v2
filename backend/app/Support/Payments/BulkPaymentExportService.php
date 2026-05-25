<?php

namespace App\Support\Payments;

use App\Models\Payment\PaymentTransfer;
use Illuminate\Support\Collection;

class BulkPaymentExportService
{
    public function toPipeLines(Collection $transfers): string
    {
        return $transfers
            ->map(function (PaymentTransfer $transfer) {
                return implode('|', [
                    $transfer->payee_handle,
                    $transfer->total_amount,
                    $transfer->communication,
                ]);
            })
            ->implode("\n");
    }
}