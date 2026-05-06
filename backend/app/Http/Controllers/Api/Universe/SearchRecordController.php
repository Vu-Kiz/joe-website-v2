<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SwcAuthorization;
use App\Models\SwcMemberImportLog;
use App\Models\SwcSector;
use App\Models\SwcSectorSearchRecord;
use App\Models\SwcSystem;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcHttp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class SearchRecordController extends Controller
{
    private const CACHE_VERSION_KEY = 'universe:search-records:version';

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    protected function readSystemUpdaterCursor(User $user): array
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

    protected function writeSystemUpdaterCursor(User $user, ?int $timestamp, ?string $eventUid): void
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

    protected function resolveImportActorHandle($user): ?string
    {
        $candidates = [
            $user?->swc_handle,
            $user?->currentSwcAccount?->swc_handle,
            $user?->discord_global_name,
            $user?->discord_username,
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) ($candidate ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    protected function parseSwcEventsFromJson(mixed $json): array
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

    protected function summarizeUsefulEvent(array $event, int $index): ?array
    {
        $text = trim((string) data_get($event, 'text', ''));

        if ($text === '') {
            return null;
        }

        $isHyperspaceArrival = stripos($text, 'Finished travelling in hyperspace, arrived at your destination') !== false;
        $isHyperlaneArrival = stripos($text, 'Hyperlane, arrived at your destination') !== false;
        // XP events: "Finished sublight travel within [SystemName] (galx, galy) at (sysx, sysy)"
        $isSublightTravel = stripos($text, 'Finished sublight travel within') !== false;

        if (!$isHyperspaceArrival && !$isHyperlaneArrival && !$isSublightTravel) {
            return null;
        }

        preg_match('/systemID=(\d+)/i', $text, $systemMatches);

        $galx = null;
        $galy = null;
        $squareName = null;

        if ($isSublightTravel) {
            // Galaxy coords appear BEFORE "at (sysx, sysy)": "[Name] (galx, galy) at (sysx, sysy)"
            if (preg_match('/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s+at\s+\(/i', $text, $coordMatches)) {
                $galx = (int) $coordMatches[1];
                $galy = (int) $coordMatches[2];
            }
            if (preg_match('/Finished sublight travel within\s+(.+?)\s+\(\s*-?\d+\s*,\s*-?\d+\s*\)/i', $text, $nameMatches)) {
                $squareName = trim(strip_tags(html_entity_decode($nameMatches[1], ENT_QUOTES | ENT_HTML5)));
            }
        } else {
            // Hyperspace/hyperlane arrivals have two formats:
            // Named:    "arrived at your destination Kuat at (galx, galy)"
            // Unnamed:  "arrived at your destination (galx, galy)"  ← deep space
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
            'index' => $index,
            'uid' => data_get($event, 'attributes.uid'),
            'type' => data_get($event, 'attributes.type'),
            'timestamp' => data_get($event, 'time.timestamp'),
            'square_name' => $squareName,
            'asteroid_uid' => isset($systemMatches[1]) ? sprintf('5:%s', $systemMatches[1]) : null,
            'galx' => $galx,
            'galy' => $galy,
            'has_asteroids' => $hasAsteroids,
            'text' => html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5),
        ];
    }

    protected function resolveSearchRecordSector(int $galx, int $galy): array
    {
        $system = SwcSystem::query()
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->first([
                'sector_id',
                'sector_uid',
            ]);

        return [
            'sector_id' => $system?->sector_id,
            'sector_uid' => $system?->sector_uid,
        ];
    }

    protected function collectPersonalEventsHistory(
        Request $request,
        User $user,
        SwcAuthorization $auth,
        ?int $stopBeforeTimestamp = null,
        ?string $stopBeforeEventUid = null
    ): array
    {
        $accessToken = $this->swcAuthorizationService->getAccessToken($user, $auth->auth_context);

        if (!$accessToken) {
            return [
                'ok' => false,
                'status' => 401,
                'message' => 'No active SWC access token is available for personal events.',
            ];
        }

        $url = rtrim((string) config('swc.api_base'), '/') . '/events/personal/xp/';
        $itemCount = 1000;
        $maxPages = 50;
        $seenEvents = 0;
        $matches = [];
        $pages = [];
        $latestTimestamp = null;
        $earliestTimestamp = null;
        $lastAttempt = null;
        $stoppedByTimestampCutoff = false;
        $cutoffEventTimestamp = null;
        $latestProcessedEventTimestamp = null;
        $latestProcessedEventUid = null;

        for ($page = 0; $page < $maxPages; $page += 1) {
            $query = [
                'start_index' => (string) ($page * $itemCount),
                'item_count' => (string) $itemCount,
            ];

            $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, ['oauth', 'bearer']);
            /** @var Response $response */
            $response = $attempt['response'];
            $lastAttempt = $attempt;

            $json = $response->json();
            $events = $this->parseSwcEventsFromJson($json);

            $pages[] = [
                'page' => $page + 1,
                'start_index' => (int) $query['start_index'],
                'count' => count($events),
                'status' => $response->status(),
                'ok' => $response->ok(),
            ];

            if (!$response->ok()) {
                return [
                    'ok' => false,
                    'status' => $response->status(),
                    'auth_mode_used' => $attempt['mode'],
                    'auth_modes_tried' => ['oauth', 'bearer'],
                    'attempts' => $attempt['attempts'],
                    'url' => $url,
                    'query' => $query,
                    'pages' => $pages,
                    'body' => $response->body(),
                    'json' => $json,
                ];
            }

            if (count($events) === 0) {
                break;
            }

            foreach ($events as $event) {
                $seenEvents += 1;
                $timestamp = data_get($event, 'time.timestamp');
                $eventUid = trim((string) data_get($event, 'attributes.uid', '')) ?: null;
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
                        $cutoffEventTimestamp = $timestampInt;
                        break;
                    }

                    if ($latestProcessedEventTimestamp === null || $timestampInt > $latestProcessedEventTimestamp) {
                        $latestProcessedEventTimestamp = $timestampInt;
                        $latestProcessedEventUid = $eventUid;
                    } elseif ($timestampInt === $latestProcessedEventTimestamp && $latestProcessedEventUid === null && $eventUid !== null) {
                        $latestProcessedEventUid = $eventUid;
                    }

                    $latestTimestamp = $latestTimestamp === null ? $timestampInt : max($latestTimestamp, $timestampInt);
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
            'ok' => true,
            'status' => 200,
            'auth_mode_used' => $lastAttempt['mode'] ?? 'oauth',
            'auth_modes_tried' => ['oauth', 'bearer'],
            'attempts' => $lastAttempt['attempts'] ?? [],
            'url' => $url,
            'query' => [
                'start_index' => '0',
                'item_count' => (string) $itemCount,
            ],
            'pages' => $pages,
            'history' => [
                'events_seen' => $seenEvents,
                'events_matched' => count($matches),
                'earliest_timestamp' => $earliestTimestamp,
                'latest_timestamp' => $latestTimestamp,
                'latest_processed_event_timestamp' => $latestProcessedEventTimestamp,
                'latest_processed_event_uid' => $latestProcessedEventUid,
                'stop_before_timestamp' => $stopBeforeTimestamp,
                'stop_before_event_uid' => $stopBeforeEventUid,
                'stopped_by_timestamp_cutoff' => $stoppedByTimestampCutoff,
                'cutoff_event_timestamp' => $cutoffEventTimestamp,
                'matches' => $matches,
            ],
        ];
    }

    protected function importMatchedEvents(array $matches, ?string $importActorHandle = null, ?int $importUserId = null): array
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
                'user_id' => $importUserId,
                'sector_id' => $record?->sector_id ?? $resolvedSector['sector_id'],
                'sector_uid' => $record?->sector_uid ?? $resolvedSector['sector_uid'],
                'asteroid_uid' => $nextAsteroidUid,
                'square_name' => $nextSquareName,
                'has_asteroids' => (bool) ($record?->has_asteroids ?? false) || (bool) ($match['has_asteroids'] ?? false),
                'is_system_searched' => true,
                'legacy_recorded_at' => $nextLegacyRecordedAt,
                'legacy_player' => $importActorHandle,
                'legacy_handle' => $importActorHandle,
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

                $record->fill($payload);
                $record->save();
                $updated += 1;
                $changedAreas[] = [
                    'galx' => $galx,
                    'galy' => $galy,
                    'square_name' => $nextSquareName,
                    'sector_uid' => $payload['sector_uid'],
                    'has_asteroids' => (bool) $payload['has_asteroids'],
                    'action' => 'updated',
                ];
                continue;
            }

            SwcSectorSearchRecord::create([
                'galx' => $galx,
                'galy' => $galy,
                ...$payload,
            ]);
            $created += 1;
            $changedAreas[] = [
                'galx' => $galx,
                'galy' => $galy,
                'square_name' => $nextSquareName,
                'sector_uid' => $payload['sector_uid'],
                'has_asteroids' => (bool) $payload['has_asteroids'],
                'action' => 'created',
            ];
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'unchanged' => $unchanged,
            'skipped' => $skipped,
            'skipped_no_coordinates' => $skippedNoCoordinates,
            'areas' => $changedAreas,
        ];
    }

    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'galx' => ['required', 'integer'],
            'galy' => ['required', 'integer'],
            'sector_uid' => ['nullable', 'string', 'max:255'],
            'asteroid_uid' => ['nullable', 'string', 'max:255'],
            'square_name' => ['nullable', 'string', 'max:255'],
            'planetoids_checked' => ['nullable', 'boolean'],
            'planetoid_1_size' => ['nullable', 'in:1x1,2x2'],
            'planetoid_2_size' => ['nullable', 'in:1x1,2x2'],
            'has_ships' => ['nullable', 'boolean'],
            'has_stations' => ['nullable', 'boolean'],
        ]);

        $slotOneSize = $data['planetoid_1_size'] ?? null;
        $slotTwoSize = $data['planetoid_2_size'] ?? null;

        $twoByTwoCount = collect([$slotOneSize, $slotTwoSize])->filter(fn ($value) => $value === '2x2')->count();
        if ($twoByTwoCount > 1) {
            return response()->json([
                'ok' => false,
                'message' => 'Only one 2x2 planetoid can be set per cell.',
            ], 422);
        }

        $planetoidsChecked = array_key_exists('planetoids_checked', $data)
            ? $data['planetoids_checked']
            : null;

        if ($planetoidsChecked === false) {
            $slotOneSize = null;
            $slotTwoSize = null;
        }

        $sector = null;
        if (!empty($data['sector_uid'])) {
            $sector = SwcSector::query()
                ->where('uid', (string) $data['sector_uid'])
                ->first();
        }

        $record = SwcSectorSearchRecord::query()
            ->where('galx', (int) $data['galx'])
            ->where('galy', (int) $data['galy'])
            ->first();

        $before = $record?->only([
            'id',
            'sector_uid',
            'asteroid_uid',
            'galx',
            'galy',
            'square_name',
            'planetoids_checked',
            'planetoid_1_type',
            'planetoid_1_size',
            'planetoid_2_type',
            'planetoid_2_size',
            'has_ships',
            'has_stations',
        ]);

        $record = SwcSectorSearchRecord::updateOrCreate(
            [
                'galx' => (int) $data['galx'],
                'galy' => (int) $data['galy'],
            ],
            [
                'sector_id' => $sector?->id ?? $record?->sector_id,
                'sector_uid' => $sector?->uid ?? ($data['sector_uid'] ?? $record?->sector_uid),
                'asteroid_uid' => array_key_exists('asteroid_uid', $data)
                    ? (trim((string) ($data['asteroid_uid'] ?? '')) ?: null)
                    : $record?->asteroid_uid,
                'square_name' => array_key_exists('square_name', $data)
                    ? (trim((string) ($data['square_name'] ?? '')) ?: null)
                    : $record?->square_name,
                'planetoids_checked' => $planetoidsChecked,
                'planetoid_1_type' => null,
                'planetoid_1_size' => $slotOneSize,
                'planetoid_2_type' => null,
                'planetoid_2_size' => $slotTwoSize,
                'has_ships' => array_key_exists('has_ships', $data) ? $data['has_ships'] : null,
                'has_stations' => array_key_exists('has_stations', $data) ? $data['has_stations'] : null,
            ]
        );

        $after = $record->only([
            'id',
            'sector_uid',
            'asteroid_uid',
            'galx',
            'galy',
            'square_name',
            'planetoids_checked',
            'planetoid_1_type',
            'planetoid_1_size',
            'planetoid_2_type',
            'planetoid_2_size',
            'has_ships',
            'has_stations',
        ]);

        AdminActionLogger::log(
            $request,
            'galaxy',
            $before ? 'update_grid_intel' : 'create_grid_intel',
            sprintf(
                'Updated grid intel at (%d, %d).',
                (int) $data['galx'],
                (int) $data['galy']
            ),
            'swc_sector_search_record',
            $record->id,
            $before,
            $after
        );

        $this->bumpCacheVersion();

        return response()->json([
            'ok' => true,
            'message' => 'Grid intel saved.',
            'data' => $record->fresh(),
        ]);
    }

    public function importPersonalEvents(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $auth = $user->swcAuthorizations()
            ->whereIn('auth_context', [
                SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                SwcAuthorization::CONTEXT_EVENTS,
            ])
            ->orderByRaw(
                'case auth_context when ? then 0 when ? then 1 else 2 end',
                [
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                    SwcAuthorization::CONTEXT_EVENTS,
                ]
            )
            ->first();

        if (!$auth || empty($auth->access_token_encrypted) || !$auth->has_personal_events_access) {
            return response()->json([
                'ok' => false,
                'message' => 'Your SWC Galaxy access is missing or has timed out. Please reconnect your access and try again.',
            ], 422);
        }

        $importActorHandle = $this->resolveImportActorHandle($user);
        $cursor = $this->readSystemUpdaterCursor($user);
        $cursorCameFromPreferences = $cursor['timestamp'] !== null;
        $stopBeforeTimestamp = $cursor['timestamp'];
        $stopBeforeEventUid = $cursor['event_uid'];

        $historyResult = $this->collectPersonalEventsHistory(
            $request,
            $user,
            $auth,
            $stopBeforeTimestamp,
            $stopBeforeEventUid
        );
        if (!($historyResult['ok'] ?? false)) {
            $upstreamStatus = (int) ($historyResult['status'] ?? 500);
            $message = match ($upstreamStatus) {
                401, 403 => 'Your SWC Galaxy access session has timed out. Please reconnect your access and try again.',
                default => 'Failed to pull SWC personal events right now. Please try again shortly.',
            };

            return response()->json([
                ...$historyResult,
                'ok' => false,
                'message' => $message,
            ], $upstreamStatus >= 400 ? $upstreamStatus : 502);
        }

        $matches = data_get($historyResult, 'history.matches', []);
        $import = $this->importMatchedEvents(
            is_array($matches) ? $matches : [],
            $importActorHandle,
            $user->id
        );

        $importedCount = (int) ($import['created'] ?? 0) + (int) ($import['updated'] ?? 0);
        if ($importedCount > 0) {
            $this->bumpCacheVersion();
        }

        SwcMemberImportLog::create([
            'user_id' => $user->id,
            'events_seen' => (int) data_get($historyResult, 'history.events_seen', 0),
            'events_matched' => (int) data_get($historyResult, 'history.events_matched', 0),
            'created' => (int) ($import['created'] ?? 0),
            'updated' => (int) ($import['updated'] ?? 0),
            'unchanged' => (int) ($import['unchanged'] ?? 0),
            'skipped' => (int) ($import['skipped'] ?? 0),
            'areas' => $import['areas'] ?? [],
        ]);

        AdminActionLogger::log(
            $request,
            'galaxy',
            'import_personal_events',
            sprintf(
                'Imported personal astrogation events: %d new, %d updated, %d unchanged, %d skipped.',
                (int) ($import['created'] ?? 0),
                (int) ($import['updated'] ?? 0),
                (int) ($import['unchanged'] ?? 0),
                (int) ($import['skipped'] ?? 0)
            ),
            null,
            null,
            null,
            [
                'created' => (int) ($import['created'] ?? 0),
                'updated' => (int) ($import['updated'] ?? 0),
                'unchanged' => (int) ($import['unchanged'] ?? 0),
                'skipped' => (int) ($import['skipped'] ?? 0),
                'areas' => array_slice($import['areas'] ?? [], 0, 50),
            ]
        );

        $latestProcessedEventTimestamp = data_get($historyResult, 'history.latest_processed_event_timestamp');
        $latestProcessedEventUid = data_get($historyResult, 'history.latest_processed_event_uid');

        if (is_numeric((string) $latestProcessedEventTimestamp)) {
            $latestTs = (int) $latestProcessedEventTimestamp;
            $currentTs = $cursor['timestamp'];
            if ($currentTs === null || $latestTs > $currentTs || ($latestTs === $currentTs && !empty($latestProcessedEventUid))) {
                $this->writeSystemUpdaterCursor(
                    $user,
                    $latestTs,
                    is_string($latestProcessedEventUid) ? $latestProcessedEventUid : null
                );
                $user->refresh();
                $cursor = $this->readSystemUpdaterCursor($user);
            }
        }

        return response()->json([
            ...$historyResult,
            'import' => $import,
            'cursor' => [
                'before' => [
                    'timestamp' => $stopBeforeTimestamp,
                    'event_uid' => $stopBeforeEventUid,
                    'source' => $cursorCameFromPreferences ? 'member_tool_preferences' : 'legacy_recorded_at_fallback',
                ],
                'after' => $cursor,
            ],
        ], 200);
    }

    public function importLogs(Request $request): JsonResponse
    {
        $user = $request->user();

        $logs = SwcMemberImportLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $logs->map(fn (SwcMemberImportLog $log) => [
                'id' => $log->id,
                'created_at' => $log->created_at?->toISOString(),
                'events_seen' => $log->events_seen,
                'events_matched' => $log->events_matched,
                'created' => $log->created,
                'updated' => $log->updated,
                'unchanged' => $log->unchanged,
                'skipped' => $log->skipped,
                'areas' => $log->areas ?? [],
            ])->values(),
        ]);
    }

    public function clearImportLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        SwcMemberImportLog::query()->where('user_id', $user->id)->delete();
        return response()->json(['ok' => true]);
    }

    private function bumpCacheVersion(): void
    {
        Cache::forever(self::CACHE_VERSION_KEY, ((int) Cache::get(self::CACHE_VERSION_KEY, 1)) + 1);
    }
}
