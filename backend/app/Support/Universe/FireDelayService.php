<?php

namespace App\Support\Universe;

use App\Support\Swc\SwcHttp;
use Illuminate\Support\Facades\DB;

class FireDelayService
{
    public const FIRE_DELAY_SECONDS = 1800; // 30 minutes — fixed for all SWC weapons

    private const MAX_PAGES = 20;
    private const ITEMS_PER_PAGE = 1000;
    private const SHIP_TYPE_PREFIX = '2:';

    /**
     * Fetch fire events from a faction event log.
     *
     * Uses /events/faction/{event_type}/ which captures ALL faction members' combat
     * actions plus enemy ships that attacked faction ships — much broader than personal
     * combat events which only cover the authenticated character.
     *
     * Pass $factionId to pull a specific faction's events (e.g. a known enemy faction).
     * Omit to use the token owner's primary faction.
     */
    public function fetchFromFactionEvents(
        string $accessToken,
        string $eventType = 'combat',
        ?int $factionId = null,
        ?int $sinceTimestamp = null
    ): array {
        $url = rtrim((string) config('swc.api_base'), '/') . '/events/faction/' . $eventType . '/';
        return $this->fetchFireEvents($accessToken, $url, $sinceTimestamp, $factionId ? ['faction_id' => (string) $factionId] : []);
    }

    /**
     * Fetch fire events from the personal combat event log.
     * Falls back to this if the user has no faction events access.
     */
    public function fetchFromPersonalEvents(string $accessToken, ?int $sinceTimestamp = null): array
    {
        $url = rtrim((string) config('swc.api_base'), '/') . '/events/combat/';
        return $this->fetchFireEvents($accessToken, $url, $sinceTimestamp);
    }

    /**
     * Core fetch loop — shared by faction and personal event sources.
     */
    private function fetchFireEvents(
        string $accessToken,
        string $url,
        ?int $sinceTimestamp,
        array $extraQuery = []
    ): array {
        $confirmedMode = null;
        $fireEvents    = [];

        for ($page = 0; $page < self::MAX_PAGES; $page++) {
            $query = array_merge($extraQuery, [
                'start_index' => (string) ($page * self::ITEMS_PER_PAGE),
                'item_count'  => (string) self::ITEMS_PER_PAGE,
            ]);

            if ($sinceTimestamp !== null) {
                $query['start_time'] = (string) $sinceTimestamp;
            }

            $modes    = $confirmedMode ? [$confirmedMode] : ['oauth', 'bearer'];
            $attempt  = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, $modes);
            $response = $attempt['response'];

            if ($response->ok() && $confirmedMode === null) {
                $confirmedMode = $attempt['mode'];
            }

            if (!$response->ok()) {
                return [
                    'ok'     => false,
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ];
            }

            $events = $this->parseCombatEvents($response->json());

            if (empty($events)) {
                break;
            }

            foreach ($events as $event) {
                $firedAt = $this->extractTimestamp($event);
                if (!$firedAt) {
                    continue;
                }

                $text = is_string($event['text'] ?? null) ? $event['text'] : '';
                if (!$this->isFireEvent($text)) {
                    continue;
                }

                // The first ship-type entity link in an attack event is the firing ship.
                $ships = $this->extractShipsFromText($text);
                if (empty($ships)) {
                    continue;
                }

                $firing = $ships[0];
                $uid    = $firing['uid'];

                if (!isset($fireEvents[$uid]) || $firedAt > $fireEvents[$uid]['fired_at']) {
                    $fireEvents[$uid] = [
                        'fired_at'  => $firedAt,
                        'name_hint' => $firing['name'],
                    ];
                }
            }

            if (count($events) < self::ITEMS_PER_PAGE) {
                break;
            }
        }

        return ['ok' => true, 'by_ship' => $fireEvents];
    }

    /**
     * Merge results from multiple event sources (faction + personal + enemy faction).
     * Keeps the most recent fire timestamp per ship across all sources.
     */
    public function mergeFireEvents(array ...$results): array
    {
        $merged = [];

        foreach ($results as $result) {
            if (!($result['ok'] ?? false)) {
                continue;
            }

            foreach ($result['by_ship'] as $uid => $data) {
                if (!isset($merged[$uid]) || $data['fired_at'] > $merged[$uid]['fired_at']) {
                    $merged[$uid] = $data;
                }
            }
        }

        return $merged;
    }

    /**
     * Enrich fire events with DroidBrain ship data and compute fire delay status.
     */
    public function enrichWithDroidBrainData(array $byShip): array
    {
        if (empty($byShip)) {
            return [];
        }

        $uids = array_keys($byShip);

        $dbShips = DB::table('droidbrain_ships_latest')
            ->whereIn('entity_uid', $uids)
            ->get([
                'entity_uid',
                'name',
                'owner_uid',
                'owner_name',
                'class_name',
                'type_name',
                'public_status',
                'galx',
                'galy',
            ])
            ->keyBy('entity_uid');

        $now     = time();
        $results = [];

        foreach ($byShip as $uid => $data) {
            $ship             = $dbShips->get($uid);
            $firedAt          = $data['fired_at'];
            $nextFire         = $firedAt + self::FIRE_DELAY_SECONDS;
            $remainingSeconds = max(0, $nextFire - $now);

            $results[] = [
                'uid'               => $uid,
                'name'              => $ship?->name ?? $data['name_hint'] ?? null,
                'owner_uid'         => $ship?->owner_uid ?? null,
                'owner_name'        => $ship?->owner_name ?? null,
                'class_name'        => $ship?->class_name ?? null,
                'type_name'         => $ship?->type_name ?? null,
                'public_status'     => $ship?->public_status ?? null,
                'galx'              => $ship?->galx ?? null,
                'galy'              => $ship?->galy ?? null,
                'in_droidbrain'     => $ship !== null,
                'fired_at'          => $firedAt,
                'next_fire_at'      => $nextFire,
                'remaining_seconds' => $remainingSeconds,
                'is_ready'          => $remainingSeconds === 0,
            ];
        }

        usort($results, function ($a, $b) {
            if ($a['is_ready'] !== $b['is_ready']) {
                return $a['is_ready'] ? 1 : -1;
            }
            return $a['remaining_seconds'] <=> $b['remaining_seconds'];
        });

        return $results;
    }

    private function parseCombatEvents(?array $json): array
    {
        $raw = data_get($json, 'swcapi.events.event');

        if (is_array($raw) && isset($raw[0])) {
            return array_values($raw);
        }

        return is_array($raw) ? [$raw] : [];
    }

    private function extractTimestamp(array $event): ?int
    {
        $ts = data_get($event, 'time.timestamp');
        return is_numeric($ts) ? (int) $ts : null;
    }

    private function isFireEvent(string $text): bool
    {
        $lower = strtolower($text);

        if (str_contains($lower, 'hail')) {
            return false;
        }

        return str_contains($lower, 'attack')
            || str_contains($lower, 'fired')
            || str_contains($lower, 'shot')
            || str_contains($lower, 'battle report');
    }

    /**
     * Extract ship entity UIDs and names from HTML entity links in event text.
     * Only returns ship-type entities (2:XXXXX). Order matches appearance in text,
     * so index 0 is typically the firing ship in an attack event.
     */
    private function extractShipsFromText(string $text): array
    {
        $pattern = '/<a\s[^>]*href=["\'][^"\']*entity(?:%5B%5D|\[\])=([^"\'&\s]+)[^"\']*["\'][^>]*>(.*?)<\/a>/i';

        if (!preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
            return [];
        }

        $ships = [];
        foreach ($matches as $match) {
            $uid  = trim($match[1]);
            $name = strip_tags($match[2]);

            if (str_starts_with($uid, self::SHIP_TYPE_PREFIX)) {
                $ships[] = ['uid' => $uid, 'name' => $name];
            }
        }

        return $ships;
    }
}
