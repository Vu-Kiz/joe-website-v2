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

        $inspection = $this->inspectTransferForUserContext($actingUser, $transfer);

        if (!$inspection['ok'] || empty($inspection['matched_transaction'])) {
            return [
                'ok' => false,
                'already_verified' => false,
                'matched_transaction_id' => null,
                'message' => 'No matching SWC credit log transaction was found yet.',
                'inspection' => $inspection,
            ];
        }

        $matched = $inspection['matched_transaction'];

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
            'inspection' => $inspection,
        ];
    }

    public function inspectTransferForUserContext(User $actingUser, PaymentTransfer $transfer): array
    {
        return $this->inspectExpectedPaymentForUserContext(
            $actingUser,
            payerSubjectType: (string) $transfer->payer_subject_type,
            payerSubjectId: (int) $transfer->payer_subject_id,
            expectedAmount: (int) $transfer->total_amount,
            expectedReceiverUid: (string) $transfer->payee_swc_uid,
            expectedCommunication: (string) $transfer->communication,
            itemCount: 100,
            transferReference: (string) $transfer->reference,
        );
    }

    public function inspectExpectedPaymentForUserContext(
        User $actingUser,
        string $payerSubjectType,
        int $payerSubjectId,
        int $expectedAmount,
        string $expectedReceiverUid = '',
        string $expectedCommunication = '',
        int $itemCount = 100,
        ?string $transferReference = null
    ): array {
        $transactions = $this->loadTransactionsForContext(
            $actingUser,
            $payerSubjectType,
            $payerSubjectId,
            $itemCount
        );

        $matched = $this->findMatchingTransactionFromExpected(
            expectedAmount: $expectedAmount,
            expectedReceiverUid: $expectedReceiverUid,
            expectedCommunication: $expectedCommunication,
            transactions: $transactions
        );

        return [
            'ok' => true,
            'matched' => (bool) $matched,
            'transfer_reference' => $transferReference,
            'expected' => [
                'payer_subject_type' => $payerSubjectType,
                'payer_subject_id' => $payerSubjectId,
                'amount' => $expectedAmount,
                'receiver_uid' => trim($expectedReceiverUid),
                'communication' => trim($expectedCommunication),
            ],
            'matched_transaction' => $matched,
            'searched_transaction_count' => count($transactions),
            'near_matches' => $this->buildNearMatches(
                expectedAmount: $expectedAmount,
                expectedReceiverUid: $expectedReceiverUid,
                expectedCommunication: $expectedCommunication,
                transactions: $transactions
            ),
            'searched_transactions_preview' => collect($transactions)
                ->take(25)
                ->map(fn (array $tx) => $this->summarizeTransaction($tx))
                ->values()
                ->all(),
        ];
    }

    protected function loadTransactionsForTransfer(User $actingUser, PaymentTransfer $transfer): array
    {
        return $this->loadTransactionsForContext(
            $actingUser,
            (string) $transfer->payer_subject_type,
            (int) $transfer->payer_subject_id,
            100
        );
    }

    protected function loadTransactionsForContext(
        User $actingUser,
        string $payerSubjectType,
        int $payerSubjectId,
        int $itemCount = 100
    ): array {
        if ($payerSubjectType === 'user') {
            $payerUser = User::find($payerSubjectId);

            if (!$payerUser || !$payerUser->swc_character_id) {
                return [];
            }

            $payload = $this->creditLogService->getCharacterCreditLog(
                $actingUser,
                (int) $payerUser->swc_character_id,
                $itemCount
            );

            return $this->creditLogService->extractTransactions($payload);
        }

        if ($payerSubjectType === 'faction') {
            $faction = Faction::find($payerSubjectId);

            if (!$faction) {
                return [];
            }

            $payload = $this->creditLogService->getFactionCreditLog(
                $actingUser,
                $faction,
                $itemCount
            );

            return $this->creditLogService->extractTransactions($payload);
        }

        return [];
    }

    protected function findMatchingTransaction(PaymentTransfer $transfer, array $transactions): ?array
    {
        return $this->findMatchingTransactionFromExpected(
            expectedAmount: (int) $transfer->total_amount,
            expectedReceiverUid: (string) $transfer->payee_swc_uid,
            expectedCommunication: (string) $transfer->communication,
            transactions: $transactions
        );
    }

    protected function findMatchingTransactionFromExpected(
        int $expectedAmount,
        string $expectedReceiverUid,
        string $expectedCommunication,
        array $transactions
    ): ?array {
        $expectedReceiverUid = trim($expectedReceiverUid);
        $expectedCommunication = trim($expectedCommunication);

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

    protected function buildNearMatches(
        int $expectedAmount,
        string $expectedReceiverUid,
        string $expectedCommunication,
        array $transactions
    ): array {
        $expectedReceiverUid = trim($expectedReceiverUid);
        $expectedCommunication = trim($expectedCommunication);

        return collect($transactions)
            ->map(function (array $tx) use ($expectedAmount, $expectedReceiverUid, $expectedCommunication) {
                $amount = (int) data_get($tx, 'amount', 0);
                $receiverUid = trim((string) data_get($tx, 'receiver.attributes.uid', ''));
                $communication = trim((string) data_get($tx, 'communication', ''));

                $score = 0;

                if ($amount === $expectedAmount) {
                    $score += 1;
                }

                if ($expectedReceiverUid !== '' && $receiverUid === $expectedReceiverUid) {
                    $score += 1;
                }

                if ($expectedCommunication !== '' && $communication === $expectedCommunication) {
                    $score += 1;
                }

                return [
                    'score' => $score,
                    'summary' => $this->summarizeTransaction($tx),
                ];
            })
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->take(10)
            ->values()
            ->all();
    }

    protected function summarizeTransaction(array $tx): array
    {
        return [
            'transaction_id' => (int) data_get($tx, 'attributes.transaction_id', 0),
            'timestamp' => (string) data_get($tx, 'time.timestamp', ''),
            'years' => data_get($tx, 'time.years'),
            'days' => data_get($tx, 'time.days'),
            'hours' => data_get($tx, 'time.hours'),
            'mins' => data_get($tx, 'time.mins'),
            'secs' => data_get($tx, 'time.secs'),
            'amount' => (int) data_get($tx, 'amount', 0),
            'sender_uid' => (string) data_get($tx, 'sender.attributes.uid', ''),
            'sender_name' => (string) data_get($tx, 'sender.value', ''),
            'receiver_uid' => (string) data_get($tx, 'receiver.attributes.uid', ''),
            'receiver_name' => (string) data_get($tx, 'receiver.value', ''),
            'communication' => (string) data_get($tx, 'communication', ''),
        ];
    }
}