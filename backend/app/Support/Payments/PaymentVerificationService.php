<?php

namespace App\Support\Payments;

use App\Models\Faction;
use App\Models\PaymentTransfer;
use App\Models\User;
use App\Support\Swc\SwcCreditLogService;
use Illuminate\Support\Facades\DB;

class PaymentVerificationService
{
    public function __construct(
        protected SwcCreditLogService $creditLogService
    ) {
    }

    public function verifyTransferForUserContext(User $actingUser, PaymentTransfer $transfer): array
    {
        if ($transfer->status === 'verified') {
            return [
                'ok' => true,
                'already_verified' => true,
                'matched_transaction_id' => $transfer->verified_transaction_id,
                'message' => 'Transfer is already verified.',
            ];
        }

        $transactions = $this->loadTransactionsForTransfer($actingUser, $transfer);
        $matched = $this->findMatchingTransaction($transfer, $transactions);

        if (!$matched) {
            return [
                'ok' => false,
                'already_verified' => false,
                'matched_transaction_id' => null,
                'message' => 'No matching SWC credit log transaction was found yet.',
            ];
        }

        DB::transaction(function () use ($transfer, $matched) {
            $now = now();

            $transfer->update([
                'status' => 'verified',
                'verified_at' => $now,
                'paid_at' => $now,
                'verified_transaction_id' => (int) data_get($matched, 'attributes.transaction_id'),
                'meta' => array_merge($transfer->meta ?? [], [
                    'verified_creditlog_match' => [
                        'amount' => (int) data_get($matched, 'amount', 0),
                        'communication' => (string) data_get($matched, 'communication', ''),
                        'sender_uid' => (string) data_get($matched, 'sender.attributes.uid', ''),
                        'receiver_uid' => (string) data_get($matched, 'receiver.attributes.uid', ''),
                        'timestamp' => (string) data_get($matched, 'time.timestamp', ''),
                    ],
                ]),
            ]);

            foreach ($transfer->items as $item) {
                $item->update([
                    'status' => 'paid',
                    'paid_at' => $now,
                ]);
            }
        });

        return [
            'ok' => true,
            'already_verified' => false,
            'matched_transaction_id' => (int) data_get($matched, 'attributes.transaction_id'),
            'message' => 'Transfer verified from SWC credit log.',
        ];
    }

    protected function loadTransactionsForTransfer(User $actingUser, PaymentTransfer $transfer): array
    {
        if ($transfer->payer_subject_type === 'user') {
            $payerUser = User::find($transfer->payer_subject_id);

            if (!$payerUser || !$payerUser->swc_character_id) {
                return [];
            }

            $payload = $this->creditLogService->getCharacterCreditLog(
                $actingUser,
                (int) $payerUser->swc_character_id,
                100
            );

            return $this->creditLogService->extractTransactions($payload);
        }

        if ($transfer->payer_subject_type === 'faction') {
            $faction = Faction::find($transfer->payer_subject_id);

            if (!$faction) {
                return [];
            }

            $payload = $this->creditLogService->getFactionCreditLog(
                $actingUser,
                $faction,
                100
            );

            return $this->creditLogService->extractTransactions($payload);
        }

        return [];
    }

    protected function findMatchingTransaction(PaymentTransfer $transfer, array $transactions): ?array
    {
        $expectedAmount = (int) $transfer->total_amount;
        $expectedCommunication = trim((string) $transfer->communication);
        $expectedReceiverUid = trim((string) $transfer->payee_swc_uid);

        foreach ($transactions as $transaction) {
            $amount = (int) data_get($transaction, 'amount', 0);
            $communication = trim((string) data_get($transaction, 'communication', ''));
            $receiverUid = trim((string) data_get($transaction, 'receiver.attributes.uid', ''));

            if ($amount !== $expectedAmount) {
                continue;
            }

            if ($expectedReceiverUid !== '' && $receiverUid !== $expectedReceiverUid) {
                continue;
            }

            if ($expectedCommunication !== '' && $communication !== $expectedCommunication) {
                continue;
            }

            return $transaction;
        }

        return null;
    }
}