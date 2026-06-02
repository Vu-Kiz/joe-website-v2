<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcAuthorization;
use App\Models\Swc\SwcMemberImportLog;
use App\Models\Swc\SwcSector;
use App\Models\Swc\SwcSectorSearchRecord;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\ToolStore\ToolAccessService;
use App\Support\Universe\AstrogationImportService;
use App\Support\Universe\AstrogationRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SearchRecordController extends Controller
{
    private const CACHE_VERSION_KEY = 'universe:search-records:version';

    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService,
        protected AstrogationImportService $astrogationImportService,
        protected AstrogationRewardService $astrogationRewardService,
        protected ToolAccessService $toolAccessService,
    ) {
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

        $tier = $this->toolAccessService->tierForUser($user);
        $authContexts = $tier === 'full'
            ? [SwcAuthorization::CONTEXT_MEMBER_TOOLS, SwcAuthorization::CONTEXT_EVENTS, SwcAuthorization::CONTEXT_PUBLIC_TOOLS]
            : [SwcAuthorization::CONTEXT_PUBLIC_TOOLS];

        $auth = $user->swcAuthorizations()
            ->whereIn('auth_context', $authContexts)
            ->whereNull('revoked_at')
            ->orderByRaw(
                'case auth_context when ? then 0 when ? then 1 when ? then 2 else 3 end',
                [
                    SwcAuthorization::CONTEXT_MEMBER_TOOLS,
                    SwcAuthorization::CONTEXT_EVENTS,
                    SwcAuthorization::CONTEXT_PUBLIC_TOOLS,
                ]
            )
            ->first();

        if (!$auth || empty($auth->access_token_encrypted) || !$auth->has_personal_events_access) {
            return response()->json([
                'ok' => false,
                'message' => 'Your SWC Galaxy access is missing or has timed out. Please reconnect your access and try again.',
            ], 422);
        }

        $importActorHandle = $this->astrogationImportService->resolveImportActorHandle($user);
        $cursor = $this->astrogationImportService->readSystemUpdaterCursor($user);
        $cursorCameFromPreferences = $cursor['timestamp'] !== null;
        $stopBeforeTimestamp = $cursor['timestamp'];
        $stopBeforeEventUid = $cursor['event_uid'];

        $historyResult = $this->astrogationImportService->collectPersonalEventsHistory(
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
        $isPublicTier = $this->toolAccessService->tierForUser($user) === ToolAccessService::TIER_PUBLIC;

        if ($isPublicTier) {
            $import = $this->astrogationImportService->importMatchedEventsForSubscriber(
                is_array($matches) ? $matches : [],
                $user
            );
        } else {
            $import = $this->astrogationImportService->importMatchedEvents(
                is_array($matches) ? $matches : [],
                $importActorHandle,
                $user->id
            );
        }

        $importedCount = (int) ($import['created'] ?? 0) + (int) ($import['updated'] ?? 0);
        if ($importedCount > 0 && !$isPublicTier) {
            $this->bumpCacheVersion();
        }

        $rewardPaymentItem = $isPublicTier ? null : $this->astrogationRewardService->rewardForNewGrids(
            $user,
            $import['areas'] ?? []
        );

        SwcMemberImportLog::create([
            'user_id'          => $user->id,
            'events_seen'      => (int) data_get($historyResult, 'history.events_seen', 0),
            'events_matched'   => (int) data_get($historyResult, 'history.events_matched', 0),
            'created'          => (int) ($import['created'] ?? 0),
            'updated'          => (int) ($import['updated'] ?? 0),
            'unchanged'        => (int) ($import['unchanged'] ?? 0),
            'skipped'          => (int) ($import['skipped'] ?? 0),
            'areas'            => $import['areas'] ?? [],
            'reward_breakdown' => $rewardPaymentItem ? ($rewardPaymentItem->meta['breakdown'] ?? []) : null,
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
                $this->astrogationImportService->writeSystemUpdaterCursor(
                    $user,
                    $latestTs,
                    is_string($latestProcessedEventUid) ? $latestProcessedEventUid : null
                );
                $user->refresh();
                $cursor = $this->astrogationImportService->readSystemUpdaterCursor($user);
            }
        }

        return response()->json([
            ...$historyResult,
            'import' => $import,
            'reward' => $rewardPaymentItem ? [
                'payment_item_id' => $rewardPaymentItem->id,
                'total_amount' => $rewardPaymentItem->total_amount,
                'normal_grid_count' => $rewardPaymentItem->meta['normal_grid_count'] ?? 0,
                'asteroid_grid_count' => $rewardPaymentItem->meta['asteroid_grid_count'] ?? 0,
                'communication_prefix' => $rewardPaymentItem->meta['communication_prefix'] ?? null,
            ] : null,
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
                'id'               => $log->id,
                'created_at'       => $log->created_at?->toISOString(),
                'events_seen'      => $log->events_seen,
                'events_matched'   => $log->events_matched,
                'created'          => $log->created,
                'updated'          => $log->updated,
                'unchanged'        => $log->unchanged,
                'skipped'          => $log->skipped,
                'areas'            => $log->areas ?? [],
                'reward_breakdown' => $log->reward_breakdown ?? null,
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
