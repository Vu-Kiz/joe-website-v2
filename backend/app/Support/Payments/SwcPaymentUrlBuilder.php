<?php

namespace App\Support\Payments;

use App\Models\Faction;
use App\Models\PaymentTransfer;
use App\Models\User;
use RuntimeException;

class SwcPaymentUrlBuilder
{
    public function resolveSenderType(PaymentTransfer $transfer): string
    {
        if ($transfer->payer_subject_type === 'user') {
            $user = User::find($transfer->payer_subject_id);

            if (!$user || !$user->swc_character_id) {
                throw new RuntimeException('Unable to resolve personal sender type.');
            }

            return '1:' . $user->swc_character_id;
        }

        if ($transfer->payer_subject_type === 'faction') {
            $faction = Faction::find($transfer->payer_subject_id);

            if (!$faction || !$faction->swc_uid) {
                throw new RuntimeException('Unable to resolve faction sender type.');
            }

            return '20:' . $faction->swc_uid;
        }

        throw new RuntimeException('Unsupported payer subject type.');
    }

    public function buildSingleTransferUrl(PaymentTransfer $transfer): string
    {
        return 'https://www.swcombine.com/members/credits/?' . http_build_query([
            'senderType' => $this->resolveSenderType($transfer),
            'receiver' => $transfer->payee_handle,
            'amount' => $transfer->total_amount,
            'communication' => $transfer->communication,
        ]);
    }

    public function buildBulkPageUrl(PaymentTransfer $transfer): string
    {
        return 'https://www.swcombine.com/members/credits/index.php?' . http_build_query([
            'mode' => 'bulk',
            'senderType' => $this->resolveSenderType($transfer),
        ]);
    }
}