<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\User;
use RuntimeException;

class SwcCreditLogService
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function getCharacterCreditLog(User $user, int $characterId, int $itemCount = 100): array
    {
        $token = $this->swcAuthorizationService->getAccessToken($user, \App\Models\SwcAuthorization::CONTEXT_PAYMENTS);

        if (!$token) {
            throw new RuntimeException('Missing SWC OAuth access token.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/character/1:' . $characterId . '/creditlog/';

        $response = SwcHttp::make($token)->get($url, [
            'item_count' => $itemCount,
        ]);

        if (!$response->ok()) {
            throw new RuntimeException('Failed to fetch SWC character credit log.');
        }

        return $response->json() ?? [];
    }

    public function getFactionCreditLog(User $user, Faction $faction, int $itemCount = 100): array
    {
        $token = $this->swcAuthorizationService->getAccessToken($user, \App\Models\SwcAuthorization::CONTEXT_PAYMENTS);

        if (!$token) {
            throw new RuntimeException('Missing SWC OAuth access token.');
        }

        if (!$faction->swc_uid) {
            throw new RuntimeException('Faction SWC UID is missing.');
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = $apiBase . '/faction/20:' . $faction->swc_uid . '/creditlog/';

        $response = SwcHttp::make($token)->get($url, [
            'item_count' => $itemCount,
        ]);

        if (!$response->ok()) {
            throw new RuntimeException('Failed to fetch SWC faction credit log.');
        }

        return $response->json() ?? [];
    }

    public function extractTransactions(array $payload): array
    {
        $transactions = data_get($payload, 'swcapi.transactions.transaction', []);

        if (isset($transactions['attributes'])) {
            return [$transactions];
        }

        return is_array($transactions) ? $transactions : [];
    }
}
