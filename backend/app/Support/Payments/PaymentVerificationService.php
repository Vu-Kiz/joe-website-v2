<?php

namespace App\Support\Payments;

use App\Models\Faction;
use App\Models\PaymentTransfer;
use App\Models\User;
use App\Support\Swc\SwcCreditLogService;
use Illuminate\Support\Facades\DB;

class PaymentVerificationService
{
    protected const SINGLE_VERIFY_TAIL_PAGES = 5;

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
                'message' => $this->buildNoMatchMessage($inspection),
                'inspection' => $inspection,
            ];
        }

        $matched = $inspection['matched_transaction'];

        $this->markTransferVerified($transfer, $matched);

        return [
            'ok' => true,
            'already_verified' => false,
            'matched_transaction_id' => (int) data_get($matched, 'attributes.transaction_id'),
            'message' => 'Transfer verified from SWC credit log.',
            'inspection' => $inspection,
        ];
    }

    public function verifyTransfersForUserContext(User $actingUser, iterable $transfers, int $itemCount = 100): array
    {
        $transactionsByContext = [];
        $verified = 0;
        $alreadyVerified = 0;
        $unmatched = 0;
        $errors = 0;
        $processed = 0;
        $matches = [];
        $failures = [];

        foreach ($transfers as $transfer) {
            if (!$transfer instanceof PaymentTransfer) {
                continue;
            }

            $processed += 1;

            if ($transfer->status === 'verified') {
                $alreadyVerified += 1;
                continue;
            }

            $contextKey = $transfer->payer_subject_type . ':' . (string) $transfer->payer_subject_id;

            try {
                if (!array_key_exists($contextKey, $transactionsByContext)) {
                    $transactionsByContext[$contextKey] = $this->loadTransactionsForContext(
                        $actingUser,
                        (string) $transfer->payer_subject_type,
                        (int) $transfer->payer_subject_id,
                        $itemCount
                    );
                }

                $matched = $this->findMatchingTransaction($transfer, $transactionsByContext[$contextKey]);

                if (!$matched) {
                    $unmatched += 1;

                    if (count($failures) < 10) {
                        $failures[] = [
                            'transfer_id' => $transfer->id,
                            'reference' => $transfer->reference,
                            'payee' => $transfer->payee_handle ?: $transfer->payee_label,
                            'amount' => (int) $transfer->total_amount,
                            'context' => $contextKey,
                        ];
                    }

                    continue;
                }

                $this->markTransferVerified($transfer, $matched);
                $verified += 1;

                if (count($matches) < 10) {
                    $matches[] = [
                        'transfer_id' => $transfer->id,
                        'reference' => $transfer->reference,
                        'transaction_id' => (int) data_get($matched, 'attributes.transaction_id', 0),
                        'payee' => $transfer->payee_handle ?: $transfer->payee_label,
                        'amount' => (int) $transfer->total_amount,
                        'context' => $contextKey,
                    ];
                }
            } catch (\Throwable $e) {
                $errors += 1;

                if (count($failures) < 10) {
                    $failures[] = [
                        'transfer_id' => $transfer->id,
                        'reference' => $transfer->reference,
                        'error' => $e->getMessage(),
                        'context' => $contextKey,
                    ];
                }
            }
        }

        return [
            'ok' => true,
            'processed' => $processed,
            'verified' => $verified,
            'already_verified' => $alreadyVerified,
            'unmatched' => $unmatched,
            'errors' => $errors,
            'contexts_loaded' => count($transactionsByContext),
            'message' => "Verified {$verified} transfer(s), {$alreadyVerified} already verified, {$unmatched} unmatched, {$errors} errors.",
            'matches' => $matches,
            'failures' => $failures,
        ];
    }

    public function inspectTransferForUserContext(User $actingUser, PaymentTransfer $transfer): array
    {
        $inspection = $this->inspectExpectedPaymentForUserContext(
            $actingUser,
            payerSubjectType: (string) $transfer->payer_subject_type,
            payerSubjectId: (int) $transfer->payer_subject_id,
            expectedAmount: (int) $transfer->total_amount,
            expectedReceiverUid: (string) $transfer->payee_swc_uid,
            expectedCommunication: (string) $transfer->communication,
            itemCount: 0,
            transferReference: (string) $transfer->reference,
        );

        $inspection['debug'] = $this->buildTransferInspectionDebug($transfer, tailPages: self::SINGLE_VERIFY_TAIL_PAGES);

        return $inspection;
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
        $transactions = $itemCount === 0
            ? $this->loadTransactionsForContextFromTail(
                $actingUser,
                $payerSubjectType,
                $payerSubjectId,
                self::SINGLE_VERIFY_TAIL_PAGES
            )
            : $this->loadTransactionsForContext(
                $actingUser,
                $payerSubjectType,
                $payerSubjectId,
                $itemCount
            );

        $matched = $this->findMatchingTransactionFromExpected(
            expectedAmount: $expectedAmount,
            expectedReceiverUid: $expectedReceiverUid,
            expectedCommunication: $expectedCommunication,
            transferReference: $transferReference,
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
                'communication' => $this->normalizeTransferReference($transferReference) !== ''
                    ? null
                    : trim($expectedCommunication),
            ],
            'matched_transaction' => $matched,
            'searched_transaction_count' => count($transactions),
            'near_matches' => $this->buildNearMatches(
                expectedAmount: $expectedAmount,
                expectedReceiverUid: $expectedReceiverUid,
                expectedCommunication: $expectedCommunication,
                transferReference: $transferReference,
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

    protected function loadTransactionsForContextFromTail(
        User $actingUser,
        string $payerSubjectType,
        int $payerSubjectId,
        int $pageCount
    ): array {
        if ($payerSubjectType === 'user') {
            $payerUser = User::find($payerSubjectId);

            if (!$payerUser || !$payerUser->swc_character_id) {
                return [];
            }

            return $this->creditLogService->getCharacterTransactionsFromTail(
                $actingUser,
                (int) $payerUser->swc_character_id,
                $pageCount
            );
        }

        if ($payerSubjectType === 'faction') {
            $faction = Faction::find($payerSubjectId);

            if (!$faction) {
                return [];
            }

            return $this->creditLogService->getFactionTransactionsFromTail(
                $actingUser,
                $faction,
                $pageCount
            );
        }

        return [];
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

            return $this->creditLogService->getCharacterTransactions(
                $actingUser,
                (int) $payerUser->swc_character_id,
                $itemCount
            );
        }

        if ($payerSubjectType === 'faction') {
            $faction = Faction::find($payerSubjectId);

            if (!$faction) {
                return [];
            }

            return $this->creditLogService->getFactionTransactions(
                $actingUser,
                $faction,
                $itemCount
            );
        }

        return [];
    }

    protected function buildTransferInspectionDebug(PaymentTransfer $transfer, ?int $itemCount = null, ?int $tailPages = null): array
    {
        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $query = $tailPages !== null
            ? '?item_count=50&tail_pages=' . max(1, $tailPages)
            : '?item_count=' . max(1, (int) $itemCount);

        if ($transfer->payer_subject_type === 'user') {
            $payerUser = User::find((int) $transfer->payer_subject_id);
            $characterId = $payerUser?->swc_character_id ? (int) $payerUser->swc_character_id : null;

            return [
                'payer_label' => $transfer->payer_label,
                'payer_subject_type' => 'user',
                'payer_subject_id' => $transfer->payer_subject_id,
                'sender_swc_uid' => $characterId ? ('1:' . $characterId) : null,
                'endpoint' => $characterId
                    ? $apiBase . '/character/1:' . $characterId . '/creditlog/' . $query
                    : null,
            ];
        }

        if ($transfer->payer_subject_type === 'faction') {
            $faction = Faction::find((int) $transfer->payer_subject_id);
            $factionUid = $faction?->swc_uid ? (int) $faction->swc_uid : null;

            return [
                'payer_label' => $transfer->payer_label,
                'payer_subject_type' => 'faction',
                'payer_subject_id' => $transfer->payer_subject_id,
                'sender_swc_uid' => $factionUid ? ('20:' . $factionUid) : null,
                'endpoint' => $factionUid
                    ? $apiBase . '/faction/20:' . $factionUid . '/creditlog/' . $query
                    : null,
            ];
        }

        return [
            'payer_label' => $transfer->payer_label,
            'payer_subject_type' => $transfer->payer_subject_type,
            'payer_subject_id' => $transfer->payer_subject_id,
            'sender_swc_uid' => null,
            'endpoint' => null,
        ];
    }

    protected function findMatchingTransaction(PaymentTransfer $transfer, array $transactions): ?array
    {
        return $this->findMatchingTransactionFromExpected(
            expectedAmount: (int) $transfer->total_amount,
            expectedReceiverUid: (string) $transfer->payee_swc_uid,
            expectedCommunication: (string) $transfer->communication,
            transferReference: (string) $transfer->reference,
            transactions: $transactions
        );
    }

    protected function findMatchingTransactionFromExpected(
        int $expectedAmount,
        string $expectedReceiverUid,
        string $expectedCommunication,
        ?string $transferReference,
        array $transactions
    ): ?array {
        $expectedReceiverUid = trim($expectedReceiverUid);
        $expectedCommunication = trim($expectedCommunication);
        $transferReference = $this->normalizeTransferReference($transferReference);

        if ($transferReference !== '') {
            foreach ($transactions as $transaction) {
                $transactionReference = $this->extractTransferReferenceFromTransaction($transaction);

                if ($transactionReference !== $transferReference) {
                    continue;
                }

                return $transaction;
            }

            return null;
        }

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
        ?string $transferReference,
        array $transactions
    ): array {
        $expectedReceiverUid = trim($expectedReceiverUid);
        $expectedCommunication = trim($expectedCommunication);
        $transferReference = $this->normalizeTransferReference($transferReference);

        if ($transferReference !== '') {
            return [];
        }

        return collect($transactions)
            ->map(function (array $tx) use ($expectedAmount, $expectedReceiverUid, $expectedCommunication, $transferReference) {
                $amount = (int) data_get($tx, 'amount', 0);
                $receiverUid = trim((string) data_get($tx, 'receiver.attributes.uid', ''));
                $communication = trim((string) data_get($tx, 'communication', ''));
                $transactionReference = $this->extractTransferReference($communication);

                $score = 0;

                if ($transferReference !== '' && $transactionReference === $transferReference) {
                    $score += 3;
                }

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

    protected function extractTransferReference(string $communication): string
    {
        if (preg_match('/\b(JOE-XFER-(?:\d{14}-\d{4}|\d{8}))\b/i', $communication, $matches) === 1) {
            return strtoupper(trim($matches[1]));
        }

        return '';
    }

    protected function extractTransferReferenceFromTransaction(array $transaction): string
    {
        $candidates = [
            data_get($transaction, 'communication'),
            data_get($transaction, 'communication.value'),
            data_get($transaction, 'attributes.communication'),
            data_get($transaction, 'attributes.communication.value'),
            data_get($transaction, 'message'),
            data_get($transaction, 'message.value'),
            data_get($transaction, 'description'),
            data_get($transaction, 'description.value'),
        ];

        foreach ($candidates as $candidate) {
            $reference = $this->extractTransferReference(trim((string) $candidate));

            if ($reference !== '') {
                return $reference;
            }
        }

        $serialized = json_encode($transaction);

        if (is_string($serialized)) {
            return $this->extractTransferReference($serialized);
        }

        return '';
    }

    protected function normalizeTransferReference(?string $reference): string
    {
        $reference = trim((string) $reference);

        return $reference !== '' ? strtoupper($reference) : '';
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

    protected function buildNoMatchMessage(array $inspection): string
    {
        return 'We could not confirm this payment in the latest SWC credit log window yet. Please try SWC Sync again in a moment, or use manual verification if you have already confirmed the payment in SWC.';
    }

    protected function markTransferVerified(PaymentTransfer $transfer, array $matched): void
    {
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
    }

    public function markTransferVerifiedManually(PaymentTransfer $transfer, ?int $transactionId = null, ?string $note = null): array
    {
        DB::transaction(function () use ($transfer, $transactionId, $note) {
            $now = now();

            $meta = $transfer->meta ?? [];
            $meta['manual_verification'] = array_filter([
                'verified_at' => $now->toIso8601String(),
                'swc_transaction_id' => $transactionId,
                'note' => $note !== null ? trim($note) : null,
            ], static fn ($value) => $value !== null && $value !== '');

            $transfer->update([
                'status' => 'verified',
                'verified_at' => $now,
                'paid_at' => $now,
                'verified_transaction_id' => $transactionId ?: null,
                'meta' => $meta,
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
            'matched_transaction_id' => $transactionId ?: null,
            'message' => $transactionId
                ? "Transfer manually marked as verified using SWC transaction {$transactionId}."
                : 'Transfer manually marked as verified.',
        ];
    }
}
