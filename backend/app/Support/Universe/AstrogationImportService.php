<?php

namespace App\Support\Universe;

use App\Models\SubscriberCellRecord;
use App\Models\Swc\SwcAuthorization;
use App\Models\Swc\SwcSectorSearchRecord;
use App\Models\Swc\SwcSystem;
use App\Models\User;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcHttp;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;

class AstrogationImportService
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService,
        protected ToolAccessService $toolAccessService,
    ) {
    }

    public function readSystemUpdaterCursor(User $user): array
    {
        $prefs = is_array($user->member_tool_preferences) ? $user->member_tool_preferences : [];
        $universe = is_array($prefs['universe'] ?? null) ? $prefs['universe'] : [];
        $updater = is_array($universe['system_updater'] ?? null) ? $universe['system_updater'] : [];

        $timestamp = isset($updater['last_uploaded_timestamp']) && is_numeric((string) $updater['last_uploaded_timestamp'])
            ? (int) $updater['last_uploaded_timestamp']
            : null;
        $eventUid = isset($updater['last_uploaded_event_uid']) && trim((string) $updater['last_uploaded_event_uid']) !== ''
            ? trim((string) $updater['last_uploaded_event_uid'])
            : null;

        return [
            'timestamp' => $timestamp,
            'event_uid' => $eventUid,
        ];
    }

    public function writeSystemUpdaterCursor(User $user, ?int $timestamp, ?string $eventUid): void
    {
        $prefs = is_array($user->member_tool_preferences) ? $user->member_tool_preferences : [];
        $universe = is_array($prefs['universe'] ?? null) ? $prefs['universe'] : [];
        $updater = is_array($universe['system_updater'] ?? null) ? $universe['system_updater'] : [];

        $updater['last_uploaded_timestamp'] = $timestamp;
        $updater['last_uploaded_event_uid'] = $eventUid !== null ? trim($eventUid) : null;
        $updater['cursor_updated_at'] = now()->toIso8601String();

        $universe['system_updater'] = $updater;
        $prefs['universe'] = $universe;

        $user->member_tool_preferences = $prefs;
        $user->save();
    }

    public function resolveImportActorHandle(User $user): ?string
    {
        $candidates = [
            $user->swc_handle,
            $user->currentSwcAccount?->swc_handle,
            $user->discord_global_name,
            $user->discord_username,
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) ($candidate ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    public function parseSwcEventsFromJson(mixed $json): array
    {
        if (!is_array($json)) {
            return [];
        }

        $events = data_get($json, 'swcapi.events.event');

        if (is_array($events)) {
            return array_values($events);
        }

        return is_array($events) ? [$events] : [];
    }

    public function summarizeUsefulEvent(array $event, int $index): ?array
    {
        $text = trim((string) data_get($event, 'text', ''));

        if ($text === '') {
            return null;
        }

        $isHyperspaceArrival = stripos($text, 'Finished travelling in hyperspace, arrived at your destination') !== false;
        $isHyperlaneArrival  = stripos($text, 'Hyperlane, arrived at your destination') !== false;
        $isSublightTravel    = stripos($text, 'Finished sublight travel within') !== false;

        if (!$isHyperspaceArrival && !$isHyperlaneArrival && !$isSublightTravel) {
            return null;
        }

        preg_match('/systemID=(\d+)/i', $text, $systemMatches);

        $galx = null;
        $galy = null;
        $squareName = null;

        if ($isSublightTravel) {
            if (preg_match('/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s+at\s+\(/i', $text, $coordMatches)) {
                $galx = (int) $coordMatches[1];
                $galy = (int) $coordMatches[2];
            }
            if (preg_match('/Finished sublight travel within\s+(.+?)\s+\(\s*-?\d+\s*,\s*-?\d+\s*\)/i', $text, $nameMatches)) {
                $squareName = trim(strip_tags(html_entity_decode($nameMatches[1], ENT_QUOTES | ENT_HTML5)));
            }
        } else {
            if (preg_match('/arrived at your destination\s+(.+?)\s+at\s+\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i', $text, $namedMatches)) {
                $squareName = trim(strip_tags(html_entity_decode($namedMatches[1], ENT_QUOTES | ENT_HTML5)));
                $galx = (int) $namedMatches[2];
                $galy = (int) $namedMatches[3];
            } elseif (preg_match('/arrived at your destination\s+\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i', $text, $coordMatches)) {
                $galx = (int) $coordMatches[1];
                $galy = (int) $coordMatches[2];
            }
        }

        $hasAsteroids =
            stripos($text, 'Asteroid Field') !== false ||
            stripos($text, 'Danger: Asteroid field detected') !== false;

        return [
            'index'        => $index,
            'uid'          => data_get($event, 'attributes.uid'),
            'type'         => data_get($event, 'attributes.type'),
            'timestamp'    => data_get($event, 'time.timestamp'),
            'square_name'  => $squareName,
            'asteroid_uid' => isset($systemMatches[1]) ? sprintf('5:%s', $systemMatches[1]) : null,
            'galx'         => $galx,
            'galy'         => $galy,
            'has_asteroids'=> $hasAsteroids,
            'text'         => html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5),
        ];
    }

    public function resolveSearchRecordSector(int $galx, int $galy): array
    {
        $system = SwcSystem::query()
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->first(['sector_id', 'sector_uid']);

        return [
            'sector_id'  => $system?->sector_id,
            'sector_uid' => $system?->sector_uid,
        ];
    }

    /**
     * Fetches and parses personal XP events from SWC for the given user/auth.
     * Pass $stopBeforeTimestamp to honour the cursor (skip already-imported events).
     * Pass null to fetch everything from the beginning (admin full-pull).
     */
    public function collectPersonalEventsHistory(
        User $user,
        SwcAuthorization $auth,
        ?int $stopBeforeTimestamp = null,
        ?string $stopBeforeEventUid = null
    ): array {
        $accessToken = $this->swcAuthorizationService->getAccessToken($user, $auth->auth_context);

        if (!$accessToken) {
            return [
                'ok'      => false,
                'status'  => 401,
                'message' => 'No active SWC access token is available for personal events.',
            ];
        }

        $url       = rtrim((string) config('swc.api_base'), '/') . '/events/personal/xp/';
        $itemCount = 1000;
        $maxPages  = 50;
        $seenEvents = 0;
        $matches = [];
        $pages   = [];
        $latestTimestamp = null;
        $earliestTimestamp = null;
        $lastAttempt = null;
        $stoppedByTimestampCutoff   = false;
        $cutoffEventTimestamp        = null;
        $latestProcessedEventTimestamp = null;
        $latestProcessedEventUid     = null;

        for ($page = 0; $page < $maxPages; $page += 1) {
            $query = [
                'start_index' => (string) ($page * $itemCount),
                'item_count'  => (string) $itemCount,
            ];

            $attempt  = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, ['oauth', 'bearer']);
            /** @var Response $response */
            $response    = $attempt['response'];
            $lastAttempt = $attempt;

            $json   = $response->json();
            $events = $this->parseSwcEventsFromJson($json);

            $pages[] = [
                'page'        => $page + 1,
                'start_index' => (int) $query['start_index'],
                'count'       => count($events),
                'status'      => $response->status(),
                'ok'          => $response->ok(),
            ];

            if (!$response->ok()) {
                return [
                    'ok'              => false,
                    'status'          => $response->status(),
                    'auth_mode_used'  => $attempt['mode'],
                    'auth_modes_tried'=> ['oauth', 'bearer'],
                    'attempts'        => $attempt['attempts'],
                    'url'             => $url,
                    'query'           => $query,
                    'pages'           => $pages,
                    'body'            => $response->body(),
                    'json'            => $json,
                ];
            }

            if (count($events) === 0) {
                break;
            }

            foreach ($events as $event) {
                $seenEvents += 1;
                $timestamp  = data_get($event, 'time.timestamp');
                $eventUid   = trim((string) data_get($event, 'attributes.uid', '')) ?: null;

                if ($timestamp !== null && is_numeric((string) $timestamp)) {
                    $timestampInt = (int) $timestamp;

                    if (
                        $stopBeforeTimestamp !== null &&
                        (
                            $timestampInt < $stopBeforeTimestamp ||
                            ($timestampInt === $stopBeforeTimestamp && $stopBeforeEventUid !== null && $eventUid === $stopBeforeEventUid)
                        )
                    ) {
                        $stoppedByTimestampCutoff = true;
                        $cutoffEventTimestamp     = $timestampInt;
                        break;
                    }

                    if ($latestProcessedEventTimestamp === null || $timestampInt > $latestProcessedEventTimestamp) {
                        $latestProcessedEventTimestamp = $timestampInt;
                        $latestProcessedEventUid       = $eventUid;
                    } elseif ($timestampInt === $latestProcessedEventTimestamp && $latestProcessedEventUid === null && $eventUid !== null) {
                        $latestProcessedEventUid = $eventUid;
                    }

                    $latestTimestamp   = $latestTimestamp === null   ? $timestampInt : max($latestTimestamp, $timestampInt);
                    $earliestTimestamp = $earliestTimestamp === null ? $timestampInt : min($earliestTimestamp, $timestampInt);
                }

                $summary = $this->summarizeUsefulEvent($event, $seenEvents);
                if ($summary) {
                    $matches[] = $summary;
                }
            }

            if ($stoppedByTimestampCutoff) {
                break;
            }

            if (count($events) < $itemCount) {
                break;
            }
        }

        return [
            'ok'               => true,
            'status'           => 200,
            'auth_mode_used'   => $lastAttempt['mode'] ?? 'oauth',
            'auth_modes_tried' => ['oauth', 'bearer'],
            'attempts'         => $lastAttempt['attempts'] ?? [],
            'url'              => $url,
            'query'            => ['start_index' => '0', 'item_count' => (string) $itemCount],
            'pages'            => $pages,
            'history'          => [
                'events_seen'                       => $seenEvents,
                'events_matched'                    => count($matches),
                'earliest_timestamp'                => $earliestTimestamp,
                'latest_timestamp'                  => $latestTimestamp,
                'latest_processed_event_timestamp'  => $latestProcessedEventTimestamp,
                'latest_processed_event_uid'        => $latestProcessedEventUid,
                'stop_before_timestamp'             => $stopBeforeTimestamp,
                'stop_before_event_uid'             => $stopBeforeEventUid,
                'stopped_by_timestamp_cutoff'       => $stoppedByTimestampCutoff,
                'cutoff_event_timestamp'            => $cutoffEventTimestamp,
                'matches'                           => $matches,
            ],
        ];
    }

    public function importMatchedEvents(array $matches, ?string $importActorHandle = null, ?int $importUserId = null): array
    {
        $created = 0;
        $updated = 0;
        $unchanged = 0;
        $skipped = 0;
        $skippedNoCoordinates = 0;
        $changedAreas = [];

        foreach ($matches as $match) {
            $galx = $match['galx'] ?? null;
            $galy = $match['galy'] ?? null;

            if (!is_int($galx) || !is_int($galy)) {
                $skipped += 1;
                $skippedNoCoordinates += 1;
                continue;
            }

            $record = SwcSectorSearchRecord::query()
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->first();

            $resolvedSector = $this->resolveSearchRecordSector($galx, $galy);
            $recordedAt = null;
            if (!empty($match['timestamp']) && is_numeric((string) $match['timestamp'])) {
                $recordedAt = Carbon::createFromTimestampUTC((int) $match['timestamp']);
            }

            $nextLegacyRecordedAt = $record?->legacy_recorded_at;
            if ($recordedAt && (!$nextLegacyRecordedAt || $recordedAt->gt($nextLegacyRecordedAt))) {
                $nextLegacyRecordedAt = $recordedAt;
            }

            $nextSquareName = $record?->square_name;
            if (!empty($match['square_name'])) {
                $nextSquareName = trim((string) $match['square_name']) ?: $nextSquareName;
            }

            $nextAsteroidUid = $record?->asteroid_uid;
            if (($match['has_asteroids'] ?? false) && !empty($match['asteroid_uid'])) {
                $nextAsteroidUid = trim((string) $match['asteroid_uid']) ?: $nextAsteroidUid;
            }

            $payload = [
                'user_id'            => $importUserId,
                'sector_id'          => $record?->sector_id ?? $resolvedSector['sector_id'],
                'sector_uid'         => $record?->sector_uid ?? $resolvedSector['sector_uid'],
                'asteroid_uid'       => $nextAsteroidUid,
                'square_name'        => $nextSquareName,
                'has_asteroids'      => (bool) ($record?->has_asteroids ?? false) || (bool) ($match['has_asteroids'] ?? false),
                'is_system_searched' => true,
                'legacy_recorded_at' => $nextLegacyRecordedAt,
                'legacy_player'      => $importActorHandle,
                'legacy_handle'      => $importActorHandle,
            ];

            if ($record) {
                $isChanged =
                    $record->user_id !== $payload['user_id'] ||
                    $record->sector_id !== $payload['sector_id'] ||
                    $record->sector_uid !== $payload['sector_uid'] ||
                    $record->asteroid_uid !== $payload['asteroid_uid'] ||
                    $record->square_name !== $payload['square_name'] ||
                    (bool) $record->has_asteroids !== (bool) $payload['has_asteroids'] ||
                    !$record->is_system_searched ||
                    $record->legacy_player !== $payload['legacy_player'] ||
                    $record->legacy_handle !== $payload['legacy_handle'] ||
                    (($record->legacy_recorded_at?->toIso8601String()) !== ($payload['legacy_recorded_at']?->toIso8601String()));

                if (!$isChanged) {
                    $unchanged += 1;
                    continue;
                }

                $previousLegacyRecordedAt = $record->legacy_recorded_at
                    ? Carbon::parse((string) $record->legacy_recorded_at)->toIso8601String()
                    : null;

                $record->fill($payload);
                $record->save();
                $updated += 1;
                $changedAreas[] = [
                    'galx'                       => $galx,
                    'galy'                       => $galy,
                    'square_name'                => $nextSquareName,
                    'sector_uid'                 => $payload['sector_uid'],
                    'has_asteroids'              => (bool) $payload['has_asteroids'],
                    'action'                     => 'updated',
                    'previous_legacy_recorded_at'=> $previousLegacyRecordedAt,
                    'imported_recorded_at'       => $recordedAt?->toIso8601String(),
                    'effective_legacy_recorded_at'=> $payload['legacy_recorded_at']?->toIso8601String(),
                ];
                continue;
            }

            SwcSectorSearchRecord::create(['galx' => $galx, 'galy' => $galy, ...$payload]);
            $created += 1;
            $changedAreas[] = [
                'galx'                        => $galx,
                'galy'                        => $galy,
                'square_name'                 => $nextSquareName,
                'sector_uid'                  => $payload['sector_uid'],
                'has_asteroids'               => (bool) $payload['has_asteroids'],
                'action'                      => 'created',
                'previous_legacy_recorded_at' => null,
                'imported_recorded_at'        => $recordedAt?->toIso8601String(),
                'effective_legacy_recorded_at'=> $payload['legacy_recorded_at']?->toIso8601String(),
            ];
        }

        return [
            'created'              => $created,
            'updated'              => $updated,
            'unchanged'            => $unchanged,
            'skipped'              => $skipped,
            'skipped_no_coordinates'=> $skippedNoCoordinates,
            'areas'                => $changedAreas,
        ];
    }

    public function importMatchedEventsForSubscriber(array $matches, User $user): array
    {
        $sub = $this->toolAccessService->activeSubscriptionFor($user);

        if ($sub && $sub->subscriber_type === 'faction') {
            $ownerType = 'faction';
            $ownerId   = $sub->subscriber_id;
        } else {
            $ownerType = 'user';
            $ownerId   = $user->id;
        }

        $created  = 0;
        $updated  = 0;
        $unchanged = 0;
        $skipped  = 0;
        $changedAreas = [];

        foreach ($matches as $match) {
            $galx = $match['galx'] ?? null;
            $galy = $match['galy'] ?? null;

            if (!is_int($galx) || !is_int($galy)) {
                $skipped += 1;
                continue;
            }

            $resolvedSector = $this->resolveSearchRecordSector($galx, $galy);
            $squareName = !empty($match['square_name']) ? trim((string) $match['square_name']) : null;

            $existing = SubscriberCellRecord::query()
                ->where('owner_type', $ownerType)
                ->where('owner_id', $ownerId)
                ->where('galx', $galx)
                ->where('galy', $galy)
                ->first();

            $payload = [
                'sector_uid'         => $resolvedSector['sector_uid'],
                'square_name'        => $squareName ?? $existing?->square_name,
                'is_system_searched' => true,
                'has_asteroids'      => (bool) ($existing?->has_asteroids ?? false) || (bool) ($match['has_asteroids'] ?? false),
                'updated_by_user_id' => $user->id,
            ];

            if ($existing) {
                $isChanged =
                    $existing->is_system_searched !== true ||
                    (bool) $existing->has_asteroids !== (bool) $payload['has_asteroids'] ||
                    ($squareName && $existing->square_name !== $squareName);

                if (!$isChanged) {
                    $unchanged += 1;
                    continue;
                }

                $existing->fill($payload)->save();
                $updated += 1;
            } else {
                SubscriberCellRecord::create([
                    'owner_type' => $ownerType,
                    'owner_id'   => $ownerId,
                    'galx'       => $galx,
                    'galy'       => $galy,
                    ...$payload,
                ]);
                $created += 1;
            }

            $changedAreas[] = [
                'galx'          => $galx,
                'galy'          => $galy,
                'square_name'   => $squareName,
                'sector_uid'    => $resolvedSector['sector_uid'],
                'has_asteroids' => (bool) $payload['has_asteroids'],
                'action'        => $existing ? 'updated' : 'created',
            ];
        }

        return [
            'created'                => $created,
            'updated'                => $updated,
            'unchanged'              => $unchanged,
            'skipped'                => $skipped,
            'skipped_no_coordinates' => $skipped,
            'areas'                  => $changedAreas,
        ];
    }
}
