<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\Payment\PaymentItem;
use App\Models\Payment\PaymentTransfer;
use App\Models\Swc\SwcAuthorization;
use App\Models\Swc\SwcSectorSearchRecord;
use App\Models\Swc\SwcSystem;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\Payments\PaymentVerificationService;
use App\Support\Payments\SwcPaymentUrlBuilder;
use App\Support\Combat\CombatMathSettings;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcHttp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Validation\Rule;

class DebugController extends Controller
{
    public function __construct(
        protected PaymentVerificationService $paymentVerificationService,
        protected SwcPaymentUrlBuilder $swcPaymentUrlBuilder,
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    protected function resolveAuthorizationForContext(User $user, string $context): ?SwcAuthorization
    {
        return $user->swcAuthorizations()
            ->where('auth_context', $context)
            ->first();
    }

    protected function resolveTargetUser(Request $request, array $with = []): ?User
    {
        $targetUserId = (int) $request->query('user_id', 0);

        if ($targetUserId > 0) {
            return User::with($with)->find($targetUserId);
        }

        $user = $request->user();

        if (!$user) {
            return null;
        }

        return !empty($with) ? $user->load($with) : $user;
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

    protected function readSystemUpdaterCursor(User $user): array
    {
        $prefs = is_array($user->member_tool_preferences) ? $user->member_tool_preferences : [];
        $universe = is_array($prefs['universe'] ?? null) ? $prefs['universe'] : [];
        $updater = is_array($universe['system_updater'] ?? null) ? $universe['system_updater'] : [];

        return [
            'timestamp' => isset($updater['last_uploaded_timestamp']) && is_numeric((string) $updater['last_uploaded_timestamp'])
                ? (int) $updater['last_uploaded_timestamp']
                : null,
            'event_uid' => isset($updater['last_uploaded_event_uid']) && trim((string) $updater['last_uploaded_event_uid']) !== ''
                ? trim((string) $updater['last_uploaded_event_uid'])
                : null,
            'updated_at' => isset($updater['cursor_updated_at']) && trim((string) $updater['cursor_updated_at']) !== ''
                ? trim((string) $updater['cursor_updated_at'])
                : null,
        ];
    }

    protected function writeSystemUpdaterCursor(User $user, ?int $timestamp, ?string $eventUid): array
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
        $user->refresh();

        return $this->readSystemUpdaterCursor($user);
    }

    protected function summarizeUsefulEvent(array $event, int $index): ?array
    {
        $text = trim((string) data_get($event, 'text', ''));

        if ($text === '') {
            return null;
        }

        $isHyperspaceArrival = stripos($text, 'Finished travelling in hyperspace, arrived at your destination') !== false;
        $isHyperlaneArrival = stripos($text, 'Hyperlane, arrived at your destination') !== false;

        if (!$isHyperspaceArrival && !$isHyperlaneArrival) {
            return null;
        }

        preg_match('/at\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i', $text, $coordMatches);
        preg_match('/systemID=(\d+)/i', $text, $systemMatches);

        $squareName = null;
        if (preg_match('/arrived at your destination\s+(.+?)\s+at\s+\(\s*-?\d+\s*,\s*-?\d+\s*\)/i', $text, $nameMatches)) {
            $squareName = trim(strip_tags(html_entity_decode($nameMatches[1], ENT_QUOTES | ENT_HTML5)));
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
            'system_id' => $systemMatches[1] ?? null,
            'galx' => isset($coordMatches[1]) ? (int) $coordMatches[1] : null,
            'galy' => isset($coordMatches[2]) ? (int) $coordMatches[2] : null,
            'has_asteroids' => $hasAsteroids,
            'text' => html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5),
        ];
    }

    protected function summarizeCreditLogPayload(mixed $json): ?array
    {
        if (!is_array($json)) {
            return null;
        }

        $resource = trim((string) data_get($json, 'resource', ''));

        if (!in_array($resource, ['character_creditlog', 'faction_creditlog'], true)) {
            return null;
        }

        $transactions = data_get($json, 'swcapi.transactions.transaction', []);

        if (is_array($transactions) && isset($transactions['attributes'])) {
            $transactions = [$transactions];
        }

        $transactionList = is_array($transactions) ? array_values($transactions) : [];

        return [
            'resource' => $resource,
            'request' => data_get($json, 'request'),
            'page_transaction_count' => count($transactionList),
            'transactions_attributes' => data_get($json, 'swcapi.transactions.attributes'),
            'swcapi_attributes' => data_get($json, 'swcapi.attributes'),
            'first_transaction_id' => data_get($transactionList, '0.attributes.transaction_id'),
            'last_transaction_id' => data_get($transactionList, (string) (count($transactionList) - 1) . '.attributes.transaction_id'),
        ];
    }

    public function runtime(Request $request): JsonResponse
    {
        $pullServicePath = app_path('Support/Swc/UniversePullService.php');
        $pullServiceContents = is_file($pullServicePath)
            ? file_get_contents($pullServicePath)
            : null;

        return response()->json([
            'ok' => true,
            'data' => [
                'app_env' => config('app.env'),
                'app_debug' => (bool) config('app.debug'),
                'app_url' => config('app.url'),
                'request_host' => $request->getHost(),
                'request_scheme' => $request->getScheme(),
                'pull_service_guard_present' => is_string($pullServiceContents)
                    && str_contains($pullServiceContents, 'System refresh refused non-system identifier'),
                'pull_service_hash' => is_string($pullServiceContents)
                    ? md5($pullServiceContents)
                    : null,
            ],
        ]);
    }

    public function combatSettings(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => [
                'ship_classes' => CombatMathSettings::shipClasses(),
                'weapon_damage_types' => CombatMathSettings::weaponDamageTypes(),
                'ship_damage_type_modifiers' => CombatMathSettings::getShipDamageTypeModifiers(),
                'ship_class_modifiers' => CombatMathSettings::getShipClassModifiers(),
            ],
        ]);
    }

    public function updateCombatSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ship_damage_type_modifiers' => ['required', 'array'],
            'ship_class_modifiers' => ['required', 'array'],
        ]);

        CombatMathSettings::setShipDamageTypeModifiers($validated['ship_damage_type_modifiers'] ?? []);
        CombatMathSettings::setShipClassModifiers($validated['ship_class_modifiers'] ?? []);

        return response()->json([
            'ok' => true,
            'data' => [
                'ship_classes' => CombatMathSettings::shipClasses(),
                'weapon_damage_types' => CombatMathSettings::weaponDamageTypes(),
                'ship_damage_type_modifiers' => CombatMathSettings::getShipDamageTypeModifiers(),
                'ship_class_modifiers' => CombatMathSettings::getShipClassModifiers(),
            ],
        ]);
    }

    protected function buildEventsHistoryResponse(
        Request $request,
        User $user,
        SwcAuthorization $auth,
        string $path,
        array $baseQuery
    ): JsonResponse {
        $result = $this->collectEventsHistory($request, $user, $auth, $path, $baseQuery);

        return response()->json($result, 200);
    }

    protected function collectEventsHistory(
        Request $request,
        User $user,
        SwcAuthorization $auth,
        string $path,
        array $baseQuery,
        ?int $stopBeforeTimestamp = null,
        ?string $stopBeforeEventUid = null
    ): array {
        $normalizedPath = ltrim($path, '/');

        if (!str_contains($normalizedPath, '?') && !str_ends_with($normalizedPath, '/')) {
            $normalizedPath .= '/';
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $url = rtrim((string) config('swc.api_base'), '/') . '/' . $normalizedPath;

        $prefer = trim((string) $request->query('prefer_auth', 'oauth'));
        $modes = $prefer === 'bearer'
            ? ['bearer', 'oauth']
            : ['oauth', 'bearer'];

        $itemCount = max(1, min(1000, (int) ($baseQuery['item_count'] ?? 1000)));
        $maxPages = max(1, min(100, (int) $request->query('max_pages', 50)));
        $startIndex = max(0, (int) ($baseQuery['start_index'] ?? 0));
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
            $query = $baseQuery;
            $query['start_index'] = (string) ($startIndex + ($page * $itemCount));
            $query['item_count'] = (string) $itemCount;

            $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, $modes);
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
                    'auth_modes_tried' => $modes,
                    'attempts' => $attempt['attempts'],
                    'target_user' => [
                        'id' => $user->id,
                        'swc_handle' => $user->swc_handle,
                        'swc_character_id' => $user->swc_character_id,
                    ],
                    'authorization_summary' => [
                        'auth_context' => SwcAuthorization::CONTEXT_EVENTS,
                        'has_auth_row' => true,
                        'has_access_token' => !empty($auth->access_token_encrypted),
                        'token_expires_at' => $auth->token_expires_at?->toIso8601String(),
                        'revoked_at' => $auth->revoked_at?->toIso8601String(),
                        'last_verified_at' => $auth->last_verified_at?->toIso8601String(),
                        'granted_scopes' => $auth->granted_scopes,
                    ],
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

            foreach ($events as $eventIndex => $event) {
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
            'auth_modes_tried' => $modes,
            'attempts' => $lastAttempt['attempts'] ?? [],
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'authorization_summary' => [
                'auth_context' => SwcAuthorization::CONTEXT_EVENTS,
                'has_auth_row' => true,
                'has_access_token' => !empty($auth->access_token_encrypted),
                'token_expires_at' => $auth->token_expires_at?->toIso8601String(),
                'revoked_at' => $auth->revoked_at?->toIso8601String(),
                'last_verified_at' => $auth->last_verified_at?->toIso8601String(),
                'granted_scopes' => $auth->granted_scopes,
            ],
            'url' => $url,
            'query' => $baseQuery,
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

    protected function importMatchedEventsIntoSearchRecords(Request $request, array $matches): array
    {
        $created = 0;
        $updated = 0;
        $unchanged = 0;
        $skipped = 0;
        $skippedNoCoordinates = 0;
        $imported = [];

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

            $nextHasAsteroids = (bool) ($record?->has_asteroids ?? false) || (bool) ($match['has_asteroids'] ?? false);
            $nextSectorId = $record?->sector_id ?? $resolvedSector['sector_id'];
            $nextSectorUid = $record?->sector_uid ?? $resolvedSector['sector_uid'];

            $before = $record?->only([
                'id',
                'sector_id',
                'sector_uid',
                'galx',
                'galy',
                'square_name',
                'has_asteroids',
                'legacy_recorded_at',
            ]);

            $payload = [
                'sector_id' => $nextSectorId,
                'sector_uid' => $nextSectorUid,
                'square_name' => $nextSquareName,
                'has_asteroids' => $nextHasAsteroids,
                'legacy_recorded_at' => $nextLegacyRecordedAt,
                'legacy_player' => trim((string) ($user->swc_handle ?? $user->handle ?? '')) ?: null,
                'legacy_handle' => trim((string) ($user->swc_handle ?? $user->handle ?? '')) ?: null,
            ];

            if ($record) {
                $isChanged =
                    $record->sector_id !== $payload['sector_id'] ||
                    $record->sector_uid !== $payload['sector_uid'] ||
                    $record->square_name !== $payload['square_name'] ||
                    (bool) $record->has_asteroids !== (bool) $payload['has_asteroids'] ||
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
            } else {
                $record = SwcSectorSearchRecord::create([
                    'galx' => $galx,
                    'galy' => $galy,
                    ...$payload,
                ]);
                $created += 1;
            }

            $after = $record->only([
                'id',
                'sector_id',
                'sector_uid',
                'galx',
                'galy',
                'square_name',
                'has_asteroids',
                'legacy_recorded_at',
            ]);

            AdminActionLogger::log(
                $request,
                'galaxy',
                $before ? 'import_event_arrival_update' : 'import_event_arrival_create',
                sprintf(
                    'Imported SWC event arrival at (%d, %d).',
                    $galx,
                    $galy
                ),
                'swc_sector_search_record',
                $record->id,
                $before,
                $after
            );

            $imported[] = [
                'record_id' => $record->id,
                'uid' => $match['uid'] ?? null,
                'galx' => $record->galx,
                'galy' => $record->galy,
                'square_name' => $record->square_name,
                'has_asteroids' => (bool) $record->has_asteroids,
                'legacy_recorded_at' => $record->legacy_recorded_at?->toIso8601String(),
            ];
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'unchanged' => $unchanged,
            'skipped' => $skipped,
            'skipped_no_coordinates' => $skippedNoCoordinates,
            'imported' => $imported,
        ];
    }

    public function swcAuth(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations', 'factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $memberToolsAuth = $this->resolveAuthorizationForContext($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS);
        $paymentsAuth = $this->resolveAuthorizationForContext($user, SwcAuthorization::CONTEXT_PAYMENTS);
        $eventsAuth = $this->resolveAuthorizationForContext($user, SwcAuthorization::CONTEXT_EVENTS);
        $primaryAuth = $memberToolsAuth ?? $paymentsAuth;

        $paymentGrantedScopes = trim((string) ($primaryAuth?->granted_scopes ?? ''));
        $scopes = $paymentGrantedScopes !== ''
            ? preg_split('/\s+/', $paymentGrantedScopes) ?: []
            : [];

        $eventGrantedScopes = trim((string) ($eventsAuth?->granted_scopes ?? ''));
        $eventScopes = $eventGrantedScopes !== ''
            ? preg_split('/\s+/', $eventGrantedScopes) ?: []
            : [];

        $hasPersonalCreditLogAccess =
            in_array('character_credits', $scopes, true) ||
            in_array('character_all', $scopes, true);

        $hasFactionCreditLogAccess =
            in_array('faction_credits_read', $scopes, true) ||
            in_array('faction_all', $scopes, true);

        $hasPersonalEventsAccess =
            in_array('character_events', $eventScopes, true) ||
            in_array('character_all', $eventScopes, true);

        $hasCharacterPrivilegesAccess =
            in_array('character_privileges', $scopes, true) ||
            in_array('character_all', $scopes, true);

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                    'is_sysadmin' => (bool) $user->is_sysadmin,
                ],
                'authorization' => [
                    'exists' => (bool) $memberToolsAuth || (bool) $paymentsAuth || (bool) $eventsAuth,
                    'granted_scopes' => $primaryAuth?->granted_scopes,
                    'has_personal_events_access' => $hasPersonalEventsAccess,
                    'has_faction_events_access' => false,
                    'has_personal_credit_log_access' => $hasPersonalCreditLogAccess,
                    'has_faction_credit_log_access' => $hasFactionCreditLogAccess,
                    'has_character_privileges_access' => $hasCharacterPrivilegesAccess,
                    'token_expires_at' => $primaryAuth?->token_expires_at?->toIso8601String(),
                    'last_verified_at' => $primaryAuth?->last_verified_at?->toIso8601String(),
                    'revoked_at' => $primaryAuth?->revoked_at?->toIso8601String(),
                    'has_access_token' => !empty($primaryAuth?->access_token_encrypted),
                    'has_refresh_token' => !empty($primaryAuth?->refresh_token_encrypted),
                    'primary_auth_context' => $primaryAuth?->auth_context,
                    'events_authorization' => [
                        'exists' => (bool) $eventsAuth,
                        'granted_scopes' => $eventsAuth?->granted_scopes,
                        'token_expires_at' => $eventsAuth?->token_expires_at?->toIso8601String(),
                        'last_verified_at' => $eventsAuth?->last_verified_at?->toIso8601String(),
                        'revoked_at' => $eventsAuth?->revoked_at?->toIso8601String(),
                        'has_access_token' => !empty($eventsAuth?->access_token_encrypted),
                        'has_refresh_token' => !empty($eventsAuth?->refresh_token_encrypted),
                    ],
                    'last_oauth_exchange' => [
                        SwcAuthorization::CONTEXT_LINK_ACCOUNT => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_LINK_ACCOUNT
                        ),
                        SwcAuthorization::CONTEXT_MEMBER_TOOLS => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_MEMBER_TOOLS
                        ),
                        SwcAuthorization::CONTEXT_PAYMENTS => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_PAYMENTS
                        ),
                        SwcAuthorization::CONTEXT_EVENTS => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_EVENTS
                        ),
                        SwcAuthorization::CONTEXT_DEBUG => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_DEBUG
                        ),
                    ],
                    'last_oauth_authorize_request' => [
                        SwcAuthorization::CONTEXT_LINK_ACCOUNT => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_LINK_ACCOUNT
                        ),
                        SwcAuthorization::CONTEXT_MEMBER_TOOLS => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_MEMBER_TOOLS
                        ),
                        SwcAuthorization::CONTEXT_PAYMENTS => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_PAYMENTS
                        ),
                        SwcAuthorization::CONTEXT_EVENTS => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_EVENTS
                        ),
                        SwcAuthorization::CONTEXT_DEBUG => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                            $user,
                            SwcAuthorization::CONTEXT_DEBUG
                        ),
                    ],
                    'oauth_trace' => [
                        SwcAuthorization::CONTEXT_LINK_ACCOUNT => [
                            'authorize_request' => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_LINK_ACCOUNT
                            ),
                            'callback' => $this->swcAuthorizationService->getOauthCallbackMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_LINK_ACCOUNT
                            ),
                            'token_request' => $this->swcAuthorizationService->getOauthTokenRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_LINK_ACCOUNT
                            ),
                            'token_exchange' => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_LINK_ACCOUNT
                            ),
                            'stored_authorization' => $this->swcAuthorizationService->getOauthStoredAuthorizationMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_LINK_ACCOUNT
                            ),
                        ],
                        SwcAuthorization::CONTEXT_MEMBER_TOOLS => [
                            'authorize_request' => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_MEMBER_TOOLS
                            ),
                            'callback' => $this->swcAuthorizationService->getOauthCallbackMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_MEMBER_TOOLS
                            ),
                            'token_request' => $this->swcAuthorizationService->getOauthTokenRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_MEMBER_TOOLS
                            ),
                            'token_exchange' => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_MEMBER_TOOLS
                            ),
                            'stored_authorization' => $this->swcAuthorizationService->getOauthStoredAuthorizationMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_MEMBER_TOOLS
                            ),
                        ],
                        SwcAuthorization::CONTEXT_PAYMENTS => [
                            'authorize_request' => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_PAYMENTS
                            ),
                            'callback' => $this->swcAuthorizationService->getOauthCallbackMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_PAYMENTS
                            ),
                            'token_request' => $this->swcAuthorizationService->getOauthTokenRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_PAYMENTS
                            ),
                            'token_exchange' => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_PAYMENTS
                            ),
                            'stored_authorization' => $this->swcAuthorizationService->getOauthStoredAuthorizationMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_PAYMENTS
                            ),
                        ],
                        SwcAuthorization::CONTEXT_EVENTS => [
                            'authorize_request' => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_EVENTS
                            ),
                            'callback' => $this->swcAuthorizationService->getOauthCallbackMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_EVENTS
                            ),
                            'token_request' => $this->swcAuthorizationService->getOauthTokenRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_EVENTS
                            ),
                            'token_exchange' => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_EVENTS
                            ),
                            'stored_authorization' => $this->swcAuthorizationService->getOauthStoredAuthorizationMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_EVENTS
                            ),
                        ],
                        SwcAuthorization::CONTEXT_DEBUG => [
                            'authorize_request' => $this->swcAuthorizationService->getOauthAuthorizeRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_DEBUG
                            ),
                            'callback' => $this->swcAuthorizationService->getOauthCallbackMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_DEBUG
                            ),
                            'token_request' => $this->swcAuthorizationService->getOauthTokenRequestMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_DEBUG
                            ),
                            'token_exchange' => $this->swcAuthorizationService->getOauthTokenExchangeMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_DEBUG
                            ),
                            'stored_authorization' => $this->swcAuthorizationService->getOauthStoredAuthorizationMetadata(
                                $user,
                                SwcAuthorization::CONTEXT_DEBUG
                            ),
                        ],
                    ],
                ],
                'factions' => $user->factions->map(function ($faction) {
                    return [
                        'id' => $faction->id,
                        'name' => $faction->name,
                        'swc_uid' => $faction->swc_uid,
                        'abbreviation' => $faction->abbreviation,
                        'pivot' => [
                            'can_view_payments' => (bool) $faction->pivot?->can_view_payments,
                            'can_pay_from_faction' => (bool) $faction->pivot?->can_pay_from_faction,
                            'can_mark_payments_paid' => (bool) $faction->pivot?->can_mark_payments_paid,
                            'can_manage_jobs' => (bool) $faction->pivot?->can_manage_jobs,
                        ],
                    ];
                })->values(),
                'config' => [
                    'client_id' => Config::get('swc.client_id'),
                    'authorize_url' => Config::get('swc.authorize_url'),
                    'token_url' => Config::get('swc.token_url'),
                    'api_base' => Config::get('swc.api_base'),
                    'redirect_uri' => Config::get('swc.redirect_uri'),
                    'default_scope' => Config::get('swc.default_scope'),
                    'member_tools_scope' => Config::get('swc.member_tools_scope'),
                    'creditlog_scope' => Config::get('swc.creditlog_scope'),
                    'events_scope' => Config::get('swc.events_scope'),
                    'debug_scope' => Config::get('swc.debug_scope'),
                    'access_type' => Config::get('swc.access_type'),
                    'member_tools_access_type' => Config::get('swc.member_tools_access_type'),
                    'creditlog_access_type' => Config::get('swc.creditlog_access_type'),
                    'events_access_type' => Config::get('swc.events_access_type'),
                    'debug_access_type' => Config::get('swc.debug_access_type'),
                ],
            ],
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $factionIds = $user->factions()
            ->wherePivot('can_view_payments', true)
            ->pluck('factions.id');

        $pendingItems = PaymentItem::query()
            ->where('status', 'pending')
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $transfers = PaymentTransfer::query()
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->with('items')
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                ],
                'visible_faction_ids' => $factionIds->values(),
                'pending_items' => $pendingItems,
                'transfers' => $transfers,
            ],
        ]);
    }

    public function factions(): JsonResponse
    {
        $factions = Faction::query()
            ->orderBy('name')
            ->get(['id', 'name', 'swc_uid', 'abbreviation']);

        return response()->json([
            'ok' => true,
            'data' => $factions,
        ]);
    }

    public function rawSwc(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $context = trim((string) $request->query('auth_context', SwcAuthorization::CONTEXT_PAYMENTS));
        $auth = $this->resolveAuthorizationForContext($user, $context);

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC authorization token found for target user and context.',
            ], 422);
        }

        $path = trim((string) $request->query('path', ''));

        if ($path === '') {
            return response()->json([
                'ok' => false,
                'message' => 'path is required.',
            ], 422);
        }

        $query = $request->query();
        unset($query['path'], $query['user_id'], $query['auth_context'], $query['prefer_auth']);

        $normalizedPath = ltrim($path, '/');

        if (!str_contains($normalizedPath, '?') && !str_ends_with($normalizedPath, '/')) {
            $normalizedPath .= '/';
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $url = rtrim((string) config('swc.api_base'), '/') . '/' . $normalizedPath;

        $prefer = trim((string) $request->query('prefer_auth', 'oauth'));
        $modes = $prefer === 'bearer'
            ? ['bearer', 'oauth']
            : ['oauth', 'bearer'];

        $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, $modes);
        $response = $attempt['response'];
        $json = $response->json();

        return response()->json([
            'ok' => $response->ok(),
            'status' => $response->status(),
            'auth_mode_used' => $attempt['mode'],
            'auth_modes_tried' => $modes,
            'attempts' => $attempt['attempts'],
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'authorization_summary' => [
                'auth_context' => $context,
                'has_auth_row' => (bool) $auth,
                'has_access_token' => !empty($auth->access_token_encrypted),
                'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                'granted_scopes' => $auth?->granted_scopes,
            ],
            'url' => $url,
            'query' => $query,
            'body' => $response->body(),
            'json' => $json,
            'creditlog_summary' => $this->summarizeCreditLogPayload($json),
        ], 200);
    }

    public function eventsHistory(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $this->resolveAuthorizationForContext($user, SwcAuthorization::CONTEXT_EVENTS);

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC events authorization token found for target user.',
            ], 422);
        }

        $path = trim((string) $request->query('path', 'events/personal/'));
        if ($path === '') {
            return response()->json([
                'ok' => false,
                'message' => 'path is required.',
            ], 422);
        }

        $query = $request->query();
        unset($query['path'], $query['user_id'], $query['auth_context'], $query['max_pages'], $query['use_uploader_cursor']);

        $useUploaderCursor = $request->boolean('use_uploader_cursor', false);
        $normalizedPathForCursor = strtolower(trim($path));
        $isXpPath = str_contains($normalizedPathForCursor, 'events/personal/xp');
        $cursor = $this->readSystemUpdaterCursor($user);
        $stopBeforeTimestamp = ($useUploaderCursor && $isXpPath) ? $cursor['timestamp'] : null;
        $stopBeforeEventUid = ($useUploaderCursor && $isXpPath) ? $cursor['event_uid'] : null;

        $result = $this->collectEventsHistory($request, $user, $auth, $path, $query, $stopBeforeTimestamp, $stopBeforeEventUid);
        $result['cursor'] = [
            'applied' => $useUploaderCursor && $isXpPath,
            'before' => $cursor,
        ];

        return response()->json($result, 200);
    }

    public function importEventsHistory(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $this->resolveAuthorizationForContext($user, SwcAuthorization::CONTEXT_EVENTS);

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC events authorization token found for target user.',
            ], 422);
        }

        $path = trim((string) $request->input('path', 'events/personal/'));
        if ($path === '') {
            return response()->json([
                'ok' => false,
                'message' => 'path is required.',
            ], 422);
        }

        $query = $request->input('query', []);
        if (!is_array($query)) {
            return response()->json([
                'ok' => false,
                'message' => 'query must be an object.',
            ], 422);
        }

        $query = array_map(
            static fn ($value) => is_scalar($value) || $value === null ? (string) $value : '',
            $query
        );

        $useUploaderCursor = filter_var($request->input('use_uploader_cursor', true), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        $useUploaderCursor = $useUploaderCursor ?? true;
        $normalizedPathForCursor = strtolower(trim($path));
        $isXpPath = str_contains($normalizedPathForCursor, 'events/personal/xp');
        $cursorBefore = $this->readSystemUpdaterCursor($user);
        $stopBeforeTimestamp = ($useUploaderCursor && $isXpPath) ? $cursorBefore['timestamp'] : null;
        $stopBeforeEventUid = ($useUploaderCursor && $isXpPath) ? $cursorBefore['event_uid'] : null;

        $historyResult = $this->collectEventsHistory($request, $user, $auth, $path, $query, $stopBeforeTimestamp, $stopBeforeEventUid);
        if (!($historyResult['ok'] ?? false)) {
            return response()->json($historyResult, 200);
        }

        $matches = data_get($historyResult, 'history.matches', []);
        $import = $this->importMatchedEventsIntoSearchRecords($request, is_array($matches) ? $matches : []);

        $cursorAfter = $cursorBefore;
        if ($useUploaderCursor && $isXpPath) {
            $latestProcessedEventTimestamp = data_get($historyResult, 'history.latest_processed_event_timestamp');
            $latestProcessedEventUid = data_get($historyResult, 'history.latest_processed_event_uid');

            if (is_numeric((string) $latestProcessedEventTimestamp)) {
                $nextTimestamp = (int) $latestProcessedEventTimestamp;
                $currentTimestamp = $cursorBefore['timestamp'];
                if ($currentTimestamp === null || $nextTimestamp > $currentTimestamp || ($nextTimestamp === $currentTimestamp && !empty($latestProcessedEventUid))) {
                    $cursorAfter = $this->writeSystemUpdaterCursor(
                        $user,
                        $nextTimestamp,
                        is_string($latestProcessedEventUid) ? $latestProcessedEventUid : null
                    );
                }
            }
        }

        return response()->json([
            ...$historyResult,
            'import' => $import,
            'cursor' => [
                'applied' => $useUploaderCursor && $isXpPath,
                'before' => $cursorBefore,
                'after' => $cursorAfter,
            ],
        ], 200);
    }

    public function showSystemUpdaterCursor(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, []);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'cursor' => $this->readSystemUpdaterCursor($user),
        ]);
    }

    public function resetSystemUpdaterCursor(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, []);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $before = $this->readSystemUpdaterCursor($user);
        $after = $this->writeSystemUpdaterCursor($user, null, null);

        return response()->json([
            'ok' => true,
            'message' => 'System updater XP cursor reset.',
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'cursor' => [
                'before' => $before,
                'after' => $after,
            ],
        ]);
    }

    public function testFactionPrivilege(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $context = trim((string) $request->query('auth_context', SwcAuthorization::CONTEXT_MEMBER_TOOLS));
        $allowedContexts = [
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
            SwcAuthorization::CONTEXT_EVENTS,
            SwcAuthorization::CONTEXT_DEBUG,
            SwcAuthorization::CONTEXT_MARKET_FACTION,
        ];

        if (!in_array($context, $allowedContexts, true)) {
            return response()->json([
                'ok' => false,
                'message' => 'Unsupported auth_context.',
            ], 422);
        }

        $auth = $this->resolveAuthorizationForContext($user, $context);

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC authorization token found for target user.',
            ], 422);
        }

        $group = trim((string) $request->query('group', ''));
        $privilege = trim((string) $request->query('privilege', ''));
        $factionId = trim((string) $request->query('faction_id', ''));

        if ($factionId === '') {
            return response()->json([
                'ok' => false,
                'message' => 'faction_id is required.',
            ], 422);
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $characterUid = '1:' . $user->swc_character_id;

        $url = rtrim((string) config('swc.api_base'), '/')
            . '/character/'
            . urlencode($characterUid)
            . '/privileges/';

        if ($group !== '') {
            $url .= urlencode($group) . '/';
            if ($privilege !== '') {
                $url .= urlencode($privilege) . '/';
            }
        }

        $modes = ['oauth', 'bearer'];

        $attempt = SwcHttp::getWithOrderedAuthFallback($url, [
            'faction_id' => $factionId,
        ], $accessToken, $modes);

        $response = $attempt['response'];

        return response()->json([
            'ok' => $response->ok(),
            'status' => $response->status(),
            'auth_context_requested' => $context,
            'auth_mode_used' => $attempt['mode'],
            'auth_modes_tried' => $attempt['modes_tried'] ?? $modes,
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'authorization_summary' => [
                'auth_context' => $auth?->auth_context,
                'has_auth_row' => (bool) $auth,
                'has_access_token' => !empty($auth->access_token_encrypted),
                'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                'granted_scopes' => $auth?->granted_scopes,
            ],
            'url' => $url,
            'query' => [
                'faction_id' => $factionId,
            ],
            'body' => $response->body(),
            'json' => $response->json(),
        ], 200);
    }

    public function testPayment(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $data = $request->validate([
            'payment_transfer_id' => ['nullable', 'integer', 'exists:payment_transfers,id'],
            'payer_subject_type' => ['nullable', Rule::in(['user', 'faction'])],
            'payer_subject_id' => ['nullable', 'integer'],
            'amount' => ['nullable', 'integer', 'min:1'],
            'receiver_handle' => ['nullable', 'string', 'max:120'],
            'receiver_uid' => ['nullable', 'string', 'max:50'],
            'reference' => ['nullable', 'string', 'max:120'],
            'communication_prefix' => ['nullable', 'string', 'max:180'],
            'communication' => ['nullable', 'string', 'max:255'],
            'item_count' => ['nullable', 'integer', 'min:1', 'max:250'],
        ]);

        $itemCount = max(50, min(250, (int) ($data['item_count'] ?? 100)));

        if (!empty($data['payment_transfer_id'])) {
            $transfer = PaymentTransfer::with('items')->find($data['payment_transfer_id']);

            if (!$transfer) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Payment transfer not found.',
                ], 404);
            }

            $inspection = $this->paymentVerificationService
                ->inspectTransferForUserContext($user, $transfer);

            return response()->json([
                'ok' => true,
                'mode' => 'transfer',
                'target_user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                ],
                'transfer' => [
                    'id' => $transfer->id,
                    'reference' => $transfer->reference,
                    'payer_subject_type' => $transfer->payer_subject_type,
                    'payer_subject_id' => $transfer->payer_subject_id,
                    'payee_swc_uid' => $transfer->payee_swc_uid,
                    'payee_handle' => $transfer->payee_handle,
                    'total_amount' => $transfer->total_amount,
                    'communication' => $transfer->communication,
                    'status' => $transfer->status,
                ],
                'inspection' => $inspection,
            ]);
        }

        if (
            empty($data['payer_subject_type']) ||
            empty($data['payer_subject_id']) ||
            empty($data['amount'])
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Provide either payment_transfer_id or manual test fields: payer_subject_type, payer_subject_id, amount.',
            ], 422);
        }

        $resolvedReceiverHandle = trim((string) ($data['receiver_handle'] ?? ''));
        $resolvedReceiverUid = trim((string) ($data['receiver_uid'] ?? ''));
        $reference = trim((string) ($data['reference'] ?? ''));
        $communicationPrefix = trim((string) ($data['communication_prefix'] ?? ''));

        if ($resolvedReceiverHandle !== '' && $resolvedReceiverUid === '') {
            $receiverUser = User::query()
                ->where('swc_handle', $resolvedReceiverHandle)
                ->first();

            if ($receiverUser?->swc_character_id) {
                $resolvedReceiverUid = '1:' . $receiverUser->swc_character_id;
            }
        }

        $expectedCommunication = trim((string) ($data['communication'] ?? ''));

        if ($reference !== '') {
            $expectedCommunication = $communicationPrefix !== ''
                ? trim($communicationPrefix) . ' [' . $reference . ']'
                : 'JOE payout [' . $reference . ']';
        }

        $inspection = $this->paymentVerificationService->inspectExpectedPaymentForUserContext(
            $user,
            payerSubjectType: (string) $data['payer_subject_type'],
            payerSubjectId: (int) $data['payer_subject_id'],
            expectedAmount: (int) $data['amount'],
            expectedReceiverUid: $resolvedReceiverUid,
            expectedCommunication: $expectedCommunication,
            itemCount: $itemCount,
            transferReference: $reference !== '' ? $reference : null,
        );

        $paymentUrl = null;
        if ($resolvedReceiverHandle !== '') {
            $previewTransfer = new PaymentTransfer([
                'payer_subject_type' => (string) $data['payer_subject_type'],
                'payer_subject_id' => (int) $data['payer_subject_id'],
                'payee_handle' => $resolvedReceiverHandle,
                'payee_swc_uid' => $resolvedReceiverUid !== '' ? $resolvedReceiverUid : null,
                'total_amount' => (int) $data['amount'],
                'communication' => $expectedCommunication,
            ]);

            try {
                $paymentUrl = $this->swcPaymentUrlBuilder->buildSingleTransferUrl($previewTransfer);
            } catch (\Throwable) {
                $paymentUrl = null;
            }
        }

        return response()->json([
            'ok' => true,
            'mode' => 'manual',
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'manual_preview' => [
                'receiver_handle' => $resolvedReceiverHandle !== '' ? $resolvedReceiverHandle : null,
                'receiver_uid' => $resolvedReceiverUid !== '' ? $resolvedReceiverUid : null,
                'reference' => $reference !== '' ? $reference : null,
                'communication_prefix' => $communicationPrefix !== '' ? $communicationPrefix : null,
                'generated_communication' => $expectedCommunication !== '' ? $expectedCommunication : null,
                'payment_url' => $paymentUrl,
            ],
            'inspection' => $inspection,
        ]);
    }

    public function pullCreditLog(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $payableFactionIds = $user->factions()
            ->wherePivot('can_pay_from_faction', true)
            ->pluck('factions.id');

        $transfers = PaymentTransfer::query()
            ->whereNotIn('status', ['verified', 'paid'])
            ->where(function ($query) use ($user, $payableFactionIds) {
                $query->where(function ($q) use ($user) {
                    $q->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                });

                if ($payableFactionIds->isNotEmpty()) {
                    $query->orWhere(function ($q) use ($payableFactionIds) {
                        $q->where('payer_subject_type', 'faction')
                            ->whereIn('payer_subject_id', $payableFactionIds);
                    });
                }
            })
            ->with('items')
            ->latest()
            ->get();

        $result = $this->paymentVerificationService->verifyTransfersForUserContext($user, $transfers, 250);

        return response()->json([
            'ok' => true,
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'data' => $result,
        ]);
    }

    public function testRefreshToken(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $context = trim((string) $request->input('auth_context', SwcAuthorization::CONTEXT_MEMBER_TOOLS));
        $allowedContexts = [
            SwcAuthorization::CONTEXT_LINK_ACCOUNT,
            SwcAuthorization::CONTEXT_MEMBER_TOOLS,
            SwcAuthorization::CONTEXT_PAYMENTS,
            SwcAuthorization::CONTEXT_EVENTS,
            SwcAuthorization::CONTEXT_DEBUG,
            SwcAuthorization::CONTEXT_MARKET_FACTION,
        ];

        if (!in_array($context, $allowedContexts, true)) {
            return response()->json([
                'ok' => false,
                'message' => 'Unsupported auth_context.',
            ], 422);
        }

        $result = $this->swcAuthorizationService->forceRefreshForUser($user, $context);

        return response()->json([
            ...$result,
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
        ], ($result['ok'] ?? false) ? 200 : 422);
    }

    public function testTag(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorizations']);

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'User not found.'], 404);
        }

        $context = trim((string) $request->input('auth_context', SwcAuthorization::CONTEXT_MEMBER_TOOLS));
        $auth = $this->resolveAuthorizationForContext($user, $context);

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json(['ok' => false, 'message' => 'No SWC token for that context.'], 422);
        }

        $entityType = trim((string) $request->input('entity_type', ''));
        $entityUid  = trim((string) $request->input('entity_uid', ''));
        $tag        = trim((string) $request->input('tag', 'joe-test'));
        $method     = strtoupper(trim((string) $request->input('method', 'PUT')));

        if ($entityType === '' || $entityUid === '') {
            return response()->json(['ok' => false, 'message' => 'entity_type and entity_uid are required.'], 422);
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $apiBase = rtrim((string) config('swc.api_base'), '/');

        $swcInventory = app(\App\Support\Swc\SwcInventoryService::class);
        $pluralType = $swcInventory->pluralType($entityType);

        $url = $apiBase . '/inventory/' . rawurlencode($pluralType) . '/' . rawurlencode($entityUid) . '/tag/' . rawurlencode($tag) . '/';

        $http = SwcHttp::make($accessToken);
        $response = match ($method) {
            'DELETE' => $http->delete($url),
            default  => $http->put($url),
        };

        return response()->json([
            'ok'          => $response->ok(),
            'status'      => $response->status(),
            'url_called'  => $url,
            'method'      => $method,
            'entity_type' => $entityType,
            'plural_type' => $pluralType,
            'entity_uid'  => $entityUid,
            'tag'         => $tag,
            'body'        => $response->body(),
            'json'        => $response->json(),
        ]);
    }
}
