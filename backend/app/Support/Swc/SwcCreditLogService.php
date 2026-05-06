<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\User;
use Illuminate\Http\Client\Response;
use RuntimeException;

class SwcCreditLogService
{
    protected const PAGE_SIZE = 50;
    protected const DEFAULT_VERIFY_MAX_PAGES = 5;

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function getCharacterCreditLog(User $user, int $characterId, int $itemCount = 100): array
    {
        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/character/1:' . $characterId . '/creditlog/';

        return $this->requestCreditLogPage($user, $url, min(self::PAGE_SIZE, max(1, $itemCount)));
    }

    public function getCharacterTransactions(User $user, int $characterId, int $itemCount = 100): array
    {
        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/character/1:' . $characterId . '/creditlog/';

        return $this->fetchPagedTransactions($user, $url, $itemCount);
    }

    public function getCharacterTransactionsFromTail(User $user, int $characterId, int $pageCount = self::DEFAULT_VERIFY_MAX_PAGES): array
    {
        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/character/1:' . $characterId . '/creditlog/';

        return $this->fetchTailTransactions($user, $url, $pageCount);
    }

    public function getFactionCreditLog(User $user, Faction $faction, int $itemCount = 100): array
    {
        if (!$faction->swc_uid) {
            throw new RuntimeException('Faction SWC UID is missing.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/faction/20:' . $faction->swc_uid . '/creditlog/';

        return $this->requestCreditLogPage($user, $url, min(self::PAGE_SIZE, max(1, $itemCount)));
    }

    public function getFactionTransactions(User $user, Faction $faction, int $itemCount = 100): array
    {
        if (!$faction->swc_uid) {
            throw new RuntimeException('Faction SWC UID is missing.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/faction/20:' . $faction->swc_uid . '/creditlog/';

        return $this->fetchPagedTransactions($user, $url, $itemCount);
    }

    public function getFactionTransactionsFromTail(User $user, Faction $faction, int $pageCount = self::DEFAULT_VERIFY_MAX_PAGES): array
    {
        if (!$faction->swc_uid) {
            throw new RuntimeException('Faction SWC UID is missing.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/faction/20:' . $faction->swc_uid . '/creditlog/';

        return $this->fetchTailTransactions($user, $url, $pageCount);
    }

    public function extractTransactions(array $payload): array
    {
        $transactions = data_get($payload, 'swcapi.transactions.transaction', []);

        if (isset($transactions['attributes'])) {
            return [$transactions];
        }

        return is_array($transactions) ? $transactions : [];
    }

    protected function fetchPagedTransactions(User $user, string $url, int $itemCount): array
    {
        $transactions = [];
        $seenTransactionIds = [];
        $startIndex = null;
        $targetCount = max(self::PAGE_SIZE, $itemCount);
        $maxPages = max(
            self::DEFAULT_VERIFY_MAX_PAGES,
            (int) ceil($targetCount / self::PAGE_SIZE)
        );

        for ($page = 0; $page < $maxPages; $page += 1) {
            try {
                $payload = $this->requestCreditLogPage($user, $url, self::PAGE_SIZE, $startIndex);
            } catch (RuntimeException $e) {
                if (preg_match('/SWC status\s+(400|404)\b/i', $e->getMessage()) === 1) {
                    break;
                }

                throw $e;
            }

            $pageTransactions = $this->extractTransactions($payload);

            if ($pageTransactions === []) {
                break;
            }

            foreach ($pageTransactions as $transaction) {
                $transactionId = (int) data_get($transaction, 'attributes.transaction_id', 0);
                $dedupeKey = $transactionId > 0 ? (string) $transactionId : md5(json_encode($transaction));

                if (isset($seenTransactionIds[$dedupeKey])) {
                    continue;
                }

                $seenTransactionIds[$dedupeKey] = true;
                $transactions[] = $transaction;

                if (count($transactions) >= $targetCount) {
                    break 2;
                }
            }

            $pageCount = count($pageTransactions);

            if ($pageCount < self::PAGE_SIZE) {
                break;
            }

            $startIndex = ($startIndex ?? 0) + $pageCount;
        }

        return $transactions;
    }

    protected function fetchTailTransactions(User $user, string $url, int $pageCount): array
    {
        $pageCount = max(1, $pageCount);
        $firstPayload = $this->requestCreditLogPage($user, $url, self::PAGE_SIZE);
        $firstPageTransactions = $this->extractTransactions($firstPayload);

        if ($firstPageTransactions === []) {
            return [];
        }

        $totalTransactions = $this->extractTotalTransactionCount($firstPayload);

        if ($totalTransactions === null) {
            return $this->dedupeTransactions($firstPageTransactions);
        }

        $tailStartIndex = max(0, $totalTransactions - ($pageCount * self::PAGE_SIZE));
        $pages = [];
        $startIndex = $tailStartIndex;
        $maxPages = max(1, (int) ceil(($totalTransactions - $tailStartIndex) / self::PAGE_SIZE));

        for ($page = 0; $page < $maxPages; $page += 1) {
            if ($startIndex === 0 && $page === 0) {
                $pageTransactions = $firstPageTransactions;
            } else {
                try {
                    $payload = $this->requestCreditLogPage($user, $url, self::PAGE_SIZE, $startIndex);
                } catch (RuntimeException $e) {
                    if (preg_match('/SWC status\s+(400|404|429)\b/i', $e->getMessage()) === 1) {
                        break;
                    }

                    throw $e;
                }

                $pageTransactions = $this->extractTransactions($payload);
            }

            if ($pageTransactions === []) {
                break;
            }

            $pages[] = $pageTransactions;

            $currentPageCount = count($pageTransactions);

            if ($currentPageCount < self::PAGE_SIZE) {
                break;
            }

            $startIndex += $currentPageCount;
        }

        return $this->dedupeTransactions(array_merge(...$pages));
    }

    protected function extractTotalTransactionCount(array $payload): ?int
    {
        $total = data_get($payload, 'swcapi.transactions.attributes.total');

        if ($total === null || !is_numeric((string) $total)) {
            return null;
        }

        return max(0, (int) $total);
    }

    protected function dedupeTransactions(array $transactions): array
    {
        $deduped = [];
        $seenTransactionIds = [];

        foreach ($transactions as $transaction) {
            $transactionId = (int) data_get($transaction, 'attributes.transaction_id', 0);
            $dedupeKey = $transactionId > 0 ? (string) $transactionId : md5(json_encode($transaction));

            if (isset($seenTransactionIds[$dedupeKey])) {
                continue;
            }

            $seenTransactionIds[$dedupeKey] = true;
            $deduped[] = $transaction;
        }

        return $deduped;
    }

    protected function requestCreditLogPage(User $user, string $url, int $itemCount, ?int $startIndex = null): array
    {
        $accessToken = $this->swcAuthorizationService->getAccessToken($user, \App\Models\SwcAuthorization::CONTEXT_PAYMENTS);

        if (!$accessToken) {
            throw new RuntimeException('Missing SWC OAuth access token.');
        }

        $query = [
            'item_count' => min(self::PAGE_SIZE, max(1, $itemCount)),
        ];

        if ($startIndex !== null) {
            $query['start_index'] = $startIndex;
        }

        $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, ['oauth', 'bearer']);
        $response = $attempt['response'];

        if (!$response->ok()) {
            $mode = (string) ($attempt['mode'] ?? 'oauth');
            $status = (int) $response->status();
            $bodySummary = $this->summarizeResponseBody($response);

            $message = "Failed to fetch SWC credit log. SWC status {$status} using {$mode} auth.";

            if ($bodySummary !== '') {
                $message .= " Response: {$bodySummary}";
            }

            throw new RuntimeException($message);
        }

        return $response->json() ?? [];
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
