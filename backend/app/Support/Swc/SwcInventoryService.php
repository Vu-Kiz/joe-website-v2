<?php

declare(strict_types=1);

namespace App\Support\Swc;

use App\Models\User;
use Illuminate\Support\Facades\Config;

class SwcInventoryService
{
    // Entity types that support ownership transfer via POST /owner
    public const ASSIGNABLE_TYPES = [
        'ship', 'vehicle', 'station', 'city', 'facility',
        'item', 'npc', 'droid', 'creature',
    ];

    // Material type — no assign permission, manual transfer only
    public const MATERIAL_TYPE = 'material';

    // Singular → plural mapping for inventory URL path segments
    public const ENTITY_TYPE_PLURAL = [
        'ship'      => 'ships',
        'vehicle'   => 'vehicles',
        'station'   => 'stations',
        'city'      => 'cities',
        'facility'  => 'facilities',
        'item'      => 'items',
        'npc'       => 'npcs',
        'droid'     => 'droids',
        'creature'  => 'creatures',
        'material'  => 'materials',
    ];

    // Tag applied to faction store listings
    public const TAG_FACTION_STORE = 'joe-market';

    // Tag applied to member-to-member listings
    public const TAG_MEMBER_LISTING = 'joe-listing';

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function getAllInventory(
        string $accessToken,
        string $ownerUid,
        string $entityType,
        string $assignType = 'owner',
        int $pageSize = 200,
        int $maxPages = 20,
        ?string $tag = null
    ): array {
        $allEntities = [];
        $startEntity = 0;

        for ($page = 0; $page < $maxPages; $page++) {
            $query = [
                'item_count'  => $pageSize,
                'start_index' => $startEntity,
            ];

            $tagQuery = '';
            if ($tag !== null) {
                $encodedTag = str_replace(' ', '+', $tag);
                $tagQuery = '&filter_type[0]=tags&filter_value[0]=' . $encodedTag . '&filter_inclusion[0]=includes';
            }

            $rawQuery = $this->buildQueryString($query) . $tagQuery;
            $result = $this->getInventory($accessToken, $ownerUid, $entityType, $assignType, [], $rawQuery);

            if (!$result['ok']) {
                if ($page === 0) {
                    return $result;
                }
                break;
            }

            $raw = $result['json']['swcapi']['entities']['entity'] ?? [];
            $entities = is_array($raw) ? $raw : ($raw ? [$raw] : []);

            // SWC may return a single associative entity (not a list) — detect by checking for 'value' key
            if ($entities !== [] && array_key_exists('value', $entities)) {
                $entities = [$entities];
            }

            $allEntities = array_merge($allEntities, $entities);

            if (count($entities) < $pageSize) {
                break;
            }

            $startEntity += count($entities);
        }

        // Rebuild response in the same shape the frontend parser expects
        return [
            'ok'     => true,
            'status' => 200,
            'json'   => [
                'swcapi' => [
                    'entities' => [
                        'entity' => $allEntities,
                    ],
                ],
            ],
        ];
    }

    public function getInventory(
        string $accessToken,
        string $ownerUid,
        string $entityType,
        string $assignType = 'owner',
        array $query = [],
        string $rawQuery = ''
    ): array {
        $url = $this->apiBase()
            . '/inventory/'
            . $this->encodeUid($ownerUid)
            . '/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . rawurlencode($assignType)
            . '/';

        $queryString = $rawQuery !== '' ? $rawQuery : (!empty($query) ? $this->buildQueryString($query) : '');
        $fullUrl = $queryString !== '' ? $url . '?' . $queryString : $url;

        // Use curl directly — PSR-7 normalises [] to %5B%5D which SWC rejects.
        return $this->curlGet($fullUrl, $accessToken);
    }

    public function getEntity(string $accessToken, string $entityType, string $entityUid): array
    {
        $url = $this->apiBase()
            . '/inventory/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/';

        $response = SwcHttp::make($accessToken)->get($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
        ];
    }

    public function getEntityLocation(string $accessToken, string $entityType, string $entityUid): array
    {
        $url = $this->apiBase()
            . '/location/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/';

        $response = SwcHttp::make($accessToken)->get($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
        ];
    }

    public function getMaterialType(string $materialTypeUid): array
    {
        $url = $this->apiBase() . '/types/materials/' . rawurlencode($materialTypeUid) . '/';

        // No auth required for type info
        $response = SwcHttp::make()->get($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
        ];
    }

    public function applyTag(string $accessToken, string $entityType, string $entityUid, string $tag): array
    {
        $url = $this->apiBase()
            . '/inventory/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/tag/'
            . rawurlencode($tag)
            . '/';

        $response = SwcHttp::make($accessToken)->put($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
            'body' => $response->body(),
        ];
    }

    public function removeTag(string $accessToken, string $entityType, string $entityUid, string $tag): array
    {
        $url = $this->apiBase()
            . '/inventory/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/tag/'
            . rawurlencode($tag)
            . '/';

        $response = SwcHttp::make($accessToken)->delete($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
            'body' => $response->body(),
        ];
    }

    public function removeAllTags(string $accessToken, string $entityType, string $entityUid): array
    {
        $url = $this->apiBase()
            . '/inventory/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/tags/';

        $response = SwcHttp::make($accessToken)->delete($url);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
            'body' => $response->body(),
        ];
    }

    public function transferOwnership(
        string $accessToken,
        string $entityType,
        string $entityUid,
        string $newOwnerUid,
        string $reason = ''
    ): array {
        $url = $this->apiBase()
            . '/inventory/'
            . rawurlencode($this->pluralType($entityType))
            . '/'
            . $this->encodeUid($entityUid)
            . '/owner/';

        $payload = ['new_value' => $newOwnerUid];
        if ($reason !== '') {
            $payload['reason'] = $reason;
        }

        $response = SwcHttp::make($accessToken)->post($url, $payload);

        return [
            'ok' => $response->ok(),
            'status' => $response->status(),
            'json' => $response->json(),
            'body' => $response->body(),
        ];
    }

    public function isAssignable(string $entityType): bool
    {
        return in_array(strtolower($entityType), self::ASSIGNABLE_TYPES, true);
    }

    public function isMaterial(string $entityType): bool
    {
        return strtolower($entityType) === self::MATERIAL_TYPE;
    }

    public function resolveAccessTokenForUser(User $user): ?string
    {
        return $this->swcAuthorizationService->getAccessToken(
            $user,
            \App\Models\SwcAuthorization::CONTEXT_MEMBER_TOOLS
        );
    }

    public function pluralType(string $entityType): string
    {
        return self::ENTITY_TYPE_PLURAL[$entityType] ?? ($entityType . 's');
    }

    // Use curl so the URL is sent verbatim — PSR-7/Guzzle normalises [] to %5B%5D which SWC rejects.
    protected function curlGet(string $url, string $accessToken = ''): array
    {
        $ua = (string) Config::get('swc.http_user_agent', 'JOE API Client');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_HTTPHEADER     => array_filter([
                $accessToken !== '' ? 'Authorization: OAuth ' . $accessToken : null,
                'Accept: application/json',
                'User-Agent: ' . $ua,
            ]),
        ]);

        $body   = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = $body !== '' ? json_decode($body, true) : null;

        return [
            'ok'     => $status >= 200 && $status < 300,
            'status' => $status,
            'json'   => $json,
            'body'   => $body,
        ];
    }

    // Build a query string using [] notation for arrays (SWC doesn't accept [0] format).
    protected function buildQueryString(array $params): string
    {
        $parts = [];
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                foreach ($value as $v) {
                    $parts[] = rawurlencode($key) . '[]=' . str_replace('%20', '+', rawurlencode((string) $v));
                }
            } else {
                $parts[] = rawurlencode($key) . '=' . str_replace('%20', '+', rawurlencode((string) $value));
            }
        }
        return implode('&', $parts);
    }

    // SWC UIDs contain colons (e.g. "2:641741", "1:12345", "20:99") which must not be
    // percent-encoded in path segments — rawurlencode would break them.
    protected function encodeUid(string $uid): string
    {
        return str_replace('%3A', ':', rawurlencode($uid));
    }

    protected function apiBase(): string
    {
        return rtrim((string) Config::get('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
    }
}
