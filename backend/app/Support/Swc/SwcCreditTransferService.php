<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\PaymentTransfer;
use App\Models\SwcAuthorization;
use App\Models\User;
use Illuminate\Http\Client\Response;
use RuntimeException;

class SwcCreditTransferService
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function transferForUserContext(User $actingUser, PaymentTransfer $transfer): array
    {
        if ($transfer->payer_subject_type === 'faction') {
            return $this->transferForFactionContext($actingUser, $transfer);
        }

        $payerUser = User::find((int) $transfer->payer_subject_id);

        if (!$payerUser || !$payerUser->swc_character_id) {
            throw new RuntimeException('Personal payer SWC character is missing.');
        }

        $recipient = trim((string) ($transfer->payee_handle ?: $transfer->payee_swc_uid ?: $transfer->payee_label ?: ''));

        if ($recipient === '') {
            throw new RuntimeException('Payment recipient is missing.');
        }

        $amount = (int) $transfer->total_amount;

        if ($amount <= 0) {
            throw new RuntimeException('Payment amount must be greater than zero.');
        }

        $reason = trim((string) ($transfer->communication ?: ('JOE payout [' . $transfer->reference . ']')));

        return $this->sendCharacterCredits(
            actingUser: $actingUser,
            senderCharacterId: (int) $payerUser->swc_character_id,
            recipient: $recipient,
            amount: $amount,
            reason: $reason
        );
    }

    public function transferForFactionContext(User $actingUser, PaymentTransfer $transfer): array
    {
        $faction = Faction::find((int) $transfer->payer_subject_id);

        if (!$faction || !$faction->swc_uid) {
            throw new RuntimeException('Faction payer SWC UID is missing.');
        }

        $recipient = trim((string) ($transfer->payee_handle ?: $transfer->payee_swc_uid ?: $transfer->payee_label ?: ''));

        if ($recipient === '') {
            throw new RuntimeException('Payment recipient is missing.');
        }

        $amount = (int) $transfer->total_amount;

        if ($amount <= 0) {
            throw new RuntimeException('Payment amount must be greater than zero.');
        }

        $reason = trim((string) ($transfer->communication ?: ('JOE payout [' . $transfer->reference . ']')));
        $meta = is_array($transfer->meta) ? $transfer->meta : [];
        $budgetUid = trim((string) data_get($meta, 'faction_budget_uid', ''));

        return $this->sendFactionCredits(
            actingUser: $actingUser,
            factionUid: (string) $faction->swc_uid,
            recipient: $recipient,
            amount: $amount,
            budgetUid: $budgetUid !== '' ? $budgetUid : null,
            reason: $reason
        );
    }

    public function sendCharacterCredits(
        User $actingUser,
        int $senderCharacterId,
        string $recipient,
        int $amount,
        ?string $reason = null
    ): array {
        if ($senderCharacterId <= 0) {
            throw new RuntimeException('Sender SWC character ID is invalid.');
        }

        if ($amount <= 0) {
            throw new RuntimeException('Transfer amount must be greater than zero.');
        }

        $recipient = trim($recipient);

        if ($recipient === '') {
            throw new RuntimeException('Recipient is required.');
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken(
            $actingUser,
            SwcAuthorization::CONTEXT_PAYMENTS
        );

        if (!$accessToken) {
            throw new RuntimeException('Your Chain Code Verification for payments has timed out. Please reconnect it and try again.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/character/1:' . $senderCharacterId . '/credits/';

        $payload = array_filter([
            'recipient' => $recipient,
            'amount' => $amount,
            'reason' => $reason !== null ? trim($reason) : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $attempt = $this->postCreditsWithAuthFallback($url, $payload, $accessToken);
        $response = $attempt['response'];

        if (!$response->ok()) {
            $mode = (string) ($attempt['mode'] ?? 'oauth');
            $status = (int) $response->status();
            $bodySummary = $this->summarizeResponseBody($response);

            $message = "Failed to send SWC credits. SWC status {$status} using {$mode} auth.";

            if ($bodySummary !== '') {
                $message .= " Response: {$bodySummary}";
            }

            throw new RuntimeException($message);
        }

        $json = $response->json();
        $jsonPayload = is_array($json) ? $json : [];
        $failureReason = $this->detectExplicitTransferFailure($jsonPayload);

        if ($failureReason !== null) {
            throw new RuntimeException('SWC did not accept this transfer: ' . $failureReason);
        }

        return [
            'status' => (int) $response->status(),
            'auth_mode' => (string) ($attempt['mode'] ?? 'oauth'),
            'transaction_id' => $this->extractTransactionId($jsonPayload),
            'response' => $jsonPayload,
        ];
    }

    public function sendFactionCredits(
        User $actingUser,
        string $factionUid,
        string $recipient,
        int $amount,
        ?string $budgetUid = null,
        ?string $reason = null
    ): array {
        $factionUid = trim($factionUid);

        if ($factionUid === '') {
            throw new RuntimeException('Faction UID is required.');
        }

        if ($amount <= 0) {
            throw new RuntimeException('Transfer amount must be greater than zero.');
        }

        $recipient = trim($recipient);

        if ($recipient === '') {
            throw new RuntimeException('Recipient is required.');
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken(
            $actingUser,
            SwcAuthorization::CONTEXT_PAYMENTS
        );

        if (!$accessToken) {
            throw new RuntimeException('Your Chain Code Verification for payments has timed out. Please reconnect it and try again.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/faction/20:' . $factionUid . '/credits/';

        $payload = array_filter([
            'recipient' => $recipient,
            'amount' => $amount,
            'budget' => $budgetUid !== null ? trim($budgetUid) : null,
            'reason' => $reason !== null ? trim($reason) : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $attempt = $this->postCreditsWithAuthFallback($url, $payload, $accessToken);
        $response = $attempt['response'];

        if (!$response->ok()) {
            $mode = (string) ($attempt['mode'] ?? 'oauth');
            $status = (int) $response->status();
            $bodySummary = $this->summarizeResponseBody($response);

            $message = "Failed to send SWC faction credits. SWC status {$status} using {$mode} auth.";

            if ($bodySummary !== '') {
                $message .= " Response: {$bodySummary}";
            }

            throw new RuntimeException($message);
        }

        $json = $response->json();
        $jsonPayload = is_array($json) ? $json : [];
        $failureReason = $this->detectExplicitTransferFailure($jsonPayload);

        if ($failureReason !== null) {
            throw new RuntimeException('SWC did not accept this faction transfer: ' . $failureReason);
        }

        return [
            'status' => (int) $response->status(),
            'auth_mode' => (string) ($attempt['mode'] ?? 'oauth'),
            'transaction_id' => $this->extractTransactionId($jsonPayload),
            'response' => $jsonPayload,
        ];
    }

    protected function postCreditsWithAuthFallback(string $url, array $payload, string $accessToken): array
    {
        $firstResponse = SwcHttp::make($accessToken, 'oauth')
            ->asForm()
            ->post($url, $payload);

        if (
            $firstResponse->ok()
            || !in_array((int) $firstResponse->status(), [401, 403], true)
        ) {
            return [
                'mode' => 'oauth',
                'response' => $firstResponse,
            ];
        }

        $fallbackResponse = SwcHttp::make($accessToken, 'bearer')
            ->asForm()
            ->post($url, $payload);

        return [
            'mode' => 'bearer',
            'response' => $fallbackResponse,
        ];
    }

    protected function detectExplicitTransferFailure(array $payload): ?string
    {
        if ($payload === []) {
            return null;
        }

        $nodes = [$payload];
        $sawOutcome = false;
        $sawSuccess = false;

        while ($nodes !== []) {
            $node = array_pop($nodes);

            if (!is_array($node)) {
                continue;
            }

            if (array_is_list($node)) {
                foreach ($node as $child) {
                    if (is_array($child)) {
                        $nodes[] = $child;
                    }
                }

                continue;
            }

            if (array_key_exists('success', $node)) {
                $sawOutcome = true;
                $isSuccess = filter_var($node['success'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

                if ($isSuccess === false) {
                    return $this->extractFailureMessage($node) ?? 'transfer rejected';
                }

                if ($isSuccess === true) {
                    $sawSuccess = true;
                }
            }

            if (array_key_exists('ok', $node)) {
                $sawOutcome = true;
                $isSuccess = filter_var($node['ok'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

                if ($isSuccess === false) {
                    return $this->extractFailureMessage($node) ?? 'transfer rejected';
                }

                if ($isSuccess === true) {
                    $sawSuccess = true;
                }
            }

            if (array_key_exists('status', $node) && is_string($node['status'])) {
                $status = strtolower(trim($node['status']));

                if ($status !== '') {
                    $sawOutcome = true;
                }

                if (in_array($status, ['fail', 'failed', 'error', 'denied', 'invalid', 'rejected'], true)) {
                    return $this->extractFailureMessage($node) ?? ('status ' . $status);
                }

                if (in_array($status, ['ok', 'success', 'successful', 'completed'], true)) {
                    $sawSuccess = true;
                }
            }

            foreach ($node as $child) {
                if (is_array($child)) {
                    $nodes[] = $child;
                }
            }
        }

        if ($sawOutcome && !$sawSuccess) {
            return 'transfer result was not successful';
        }

        return null;
    }

    protected function extractFailureMessage(array $node): ?string
    {
        foreach (['message', 'error', 'reason', 'detail'] as $key) {
            if (!array_key_exists($key, $node)) {
                continue;
            }

            $value = trim((string) $node[$key]);

            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    protected function extractTransactionId(array $payload): ?int
    {
        if ($payload === []) {
            return null;
        }

        $nodes = [$payload];

        while ($nodes !== []) {
            $node = array_pop($nodes);

            if (!is_array($node)) {
                continue;
            }

            foreach (['transaction_id', 'transactionId'] as $key) {
                if (!array_key_exists($key, $node)) {
                    continue;
                }

                $value = $node[$key];

                if (is_numeric($value)) {
                    $id = (int) $value;

                    if ($id > 0) {
                        return $id;
                    }
                }
            }

            foreach ($node as $child) {
                if (is_array($child)) {
                    $nodes[] = $child;
                }
            }
        }

        return null;
    }

    protected function summarizeResponseBody(Response $response): string
    {
        $body = trim($response->body());

        if ($body === '') {
            return '';
        }

        $body = preg_replace('/\s+/', ' ', $body) ?? $body;

        if (mb_strlen($body) > 220) {
            return mb_substr($body, 0, 217) . '...';
        }

        return $body;
    }
}
