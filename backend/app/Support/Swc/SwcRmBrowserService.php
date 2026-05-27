<?php

declare(strict_types=1);

namespace App\Support\Swc;


class SwcRmBrowserService
{
    // Supported faction SWC UIDs for RM browsing
    public const FACTION_UIDS = [
        '1376' => 'Jawa Offworld Enterprises',
        '1791' => 'Jawa Offworld Enterprises: GARRY',
        '1796' => 'Jawa Offworld Enterprises: RAID',
    ];

    public function __construct(
        protected SwcInventoryService $swcInventoryService
    ) {
    }

    /**
     * Fetch all materials for a faction, exhausting all SWC pages.
     * Filters are pushed to SWC to narrow results server-side.
     *
     * @param  string       $accessToken
     * @param  string       $factionSwcUid  e.g. "1376"
     * @param  string       $factionLabel   Human-readable name
     * @param  array        $filters        Keys: sector_uid, system_uid, type_uid
     * @return array{ok: bool, entities: array, error: string|null}
     */
    public function fetchAllMaterials(
        string $accessToken,
        string $factionSwcUid,
        string $factionLabel,
        array $filters = []
    ): array {
        // type_uid is passed directly to the SWC type filter — no name lookup needed.

        $ownerUid = '20:' . $factionSwcUid;
        $allEntities = [];
        $startIndex = 0;
        $pageSize = 200;
        $maxPages = 50;

        for ($page = 0; $page < $maxPages; $page++) {
            $rawQuery = $this->buildMaterialsQuery($startIndex, $pageSize, $filters);

            $result = $this->swcInventoryService->getInventory(
                $accessToken,
                $ownerUid,
                'material',
                'owner',
                [],
                $rawQuery
            );

            if (!($result['ok'] ?? false)) {
                if ($page === 0) {
                    return [
                        'ok' => false,
                        'entities' => [],
                        'error' => 'SWC API error (' . ($result['status'] ?? 'unknown') . ') for faction ' . $factionLabel,
                    ];
                }
                break;
            }

            $raw = $result['json']['swcapi']['entities']['entity'] ?? [];
            $entities = is_array($raw) ? $raw : ($raw ? [$raw] : []);

            // SWC may return a single entity as an associative array rather than a list
            if ($entities !== [] && array_key_exists('value', $entities)) {
                $entities = [$entities];
            }

            // Tag each entity with which faction it came from
            foreach ($entities as &$entity) {
                $entity['_faction_uid'] = $factionSwcUid;
                $entity['_faction_label'] = $factionLabel;
            }
            unset($entity);

            $allEntities = array_merge($allEntities, $entities);

            if (count($entities) < $pageSize) {
                break;
            }

            $startIndex += count($entities);
        }

        return [
            'ok' => true,
            'entities' => $allEntities,
            'error' => null,
        ];
    }

    /**
     * Build the raw query string for materials inventory, pushing filters to SWC.
     */
    protected function buildMaterialsQuery(int $startIndex, int $pageSize, array $filters): string
    {
        $parts = [
            'item_count=' . $pageSize,
            'start_index=' . $startIndex,
        ];

        $filterIndex = 0;

        if (!empty($filters['sector_uid'])) {
            $parts[] = 'filter_type[]=' . rawurlencode('sector');
            $parts[] = 'filter_value[]=' . rawurlencode((string) $filters['sector_uid']);
            $parts[] = 'filter_inclusion[]=includes';
            $filterIndex++;
        }

        if (!empty($filters['system_uid'])) {
            $parts[] = 'filter_type[]=' . rawurlencode('system');
            $parts[] = 'filter_value[]=' . rawurlencode((string) $filters['system_uid']);
            $parts[] = 'filter_inclusion[]=includes';
            $filterIndex++;
        }

        if (!empty($filters['type_uid'])) {
            $parts[] = 'filter_type[]=type';
            $parts[] = 'filter_value[]=' . rawurlencode((string) $filters['type_uid']);
            $parts[] = 'filter_inclusion[]=includes';
        }

        return implode('&', $parts);
    }
}
