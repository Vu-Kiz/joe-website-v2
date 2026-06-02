<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcAuthorization;
use App\Models\Swc\SwcMemberImportLog;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\ToolStore\ToolAccessService;
use App\Support\Universe\AstrogationImportService;
use App\Support\Universe\AstrogationRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AstrogationUploadLogController extends Controller
{
    private const CACHE_VERSION_KEY = 'universe:search-records:version';

    public function __construct(
        protected AstrogationImportService $astrogationImportService,
        protected AstrogationRewardService $astrogationRewardService,
        protected ToolAccessService $toolAccessService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 250), 1000));
        $offset = max(0, (int) $request->query('offset', 0));

        $query = SwcMemberImportLog::query()
            ->with('user:id,swc_handle,discord_global_name,discord_username')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($userId = $request->query('user_id')) {
            $query->where('user_id', (int) $userId);
        }

        if ($handle = trim((string) $request->query('handle', ''))) {
            $matchingIds = User::query()
                ->where('swc_handle', 'like', "%{$handle}%")
                ->orWhere('discord_global_name', 'like', "%{$handle}%")
                ->orWhere('discord_username', 'like', "%{$handle}%")
                ->pluck('id');
            $query->whereIn('user_id', $matchingIds);
        }

        if ($dateFrom = trim((string) $request->query('date_from', ''))) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = trim((string) $request->query('date_to', ''))) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $total = $query->count();

        $logs = $query
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map(fn (SwcMemberImportLog $log) => $this->formatLog($log))
            ->values();

        return response()->json([
            'ok' => true,
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'data' => $logs,
        ]);
    }

    public function pullForUser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $targetUser = User::findOrFail((int) $validated['user_id']);

        // Resolve the best active auth for this user — try all contexts.
        $auth = $targetUser->swcAuthorizations()
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
                'message' => 'This user has no active SWC authorization with personal events access.',
            ], 422);
        }

        // Admin full-pull: no cursor cutoff — fetch everything from SWC.
        $historyResult = $this->astrogationImportService->collectPersonalEventsHistory(
            $targetUser,
            $auth,
            null,
            null
        );

        if (!($historyResult['ok'] ?? false)) {
            $upstreamStatus = (int) ($historyResult['status'] ?? 500);
            $message = match ($upstreamStatus) {
                401, 403 => 'SWC access session has expired for this user. They need to reconnect.',
                default   => 'Failed to pull SWC personal events for this user right now.',
            };

            return response()->json([
                ...$historyResult,
                'ok'      => false,
                'message' => $message,
            ], $upstreamStatus >= 400 ? $upstreamStatus : 502);
        }

        $matches      = data_get($historyResult, 'history.matches', []);
        $isPublicTier = $this->toolAccessService->tierForUser($targetUser) === ToolAccessService::TIER_PUBLIC;
        $importActorHandle = $this->astrogationImportService->resolveImportActorHandle($targetUser);

        if ($isPublicTier) {
            $import = $this->astrogationImportService->importMatchedEventsForSubscriber(
                is_array($matches) ? $matches : [],
                $targetUser
            );
        } else {
            $import = $this->astrogationImportService->importMatchedEvents(
                is_array($matches) ? $matches : [],
                $importActorHandle,
                $targetUser->id
            );
        }

        $importedCount = (int) ($import['created'] ?? 0) + (int) ($import['updated'] ?? 0);
        if ($importedCount > 0 && !$isPublicTier) {
            Cache::forever(self::CACHE_VERSION_KEY, ((int) Cache::get(self::CACHE_VERSION_KEY, 1)) + 1);
        }

        $rewardPaymentItem = $isPublicTier ? null : $this->astrogationRewardService->rewardForNewGrids(
            $targetUser,
            $import['areas'] ?? []
        );

        $importLog = SwcMemberImportLog::create([
            'user_id'          => $targetUser->id,
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
            'admin_pull_personal_events',
            sprintf(
                'Admin pulled astrogation events for %s (user #%d): %d new, %d updated, %d unchanged, %d skipped.',
                $importActorHandle ?? 'unknown',
                $targetUser->id,
                (int) ($import['created'] ?? 0),
                (int) ($import['updated'] ?? 0),
                (int) ($import['unchanged'] ?? 0),
                (int) ($import['skipped'] ?? 0)
            ),
            'user',
            $targetUser->id,
            null,
            [
                'target_user_id'   => $targetUser->id,
                'target_handle'    => $importActorHandle,
                'is_public_tier'   => $isPublicTier,
                'created'          => (int) ($import['created'] ?? 0),
                'updated'          => (int) ($import['updated'] ?? 0),
                'unchanged'        => (int) ($import['unchanged'] ?? 0),
                'skipped'          => (int) ($import['skipped'] ?? 0),
                'areas'            => array_slice($import['areas'] ?? [], 0, 50),
            ]
        );

        return response()->json([
            'ok'      => true,
            'message' => sprintf(
                'Pull complete: %d new, %d updated, %d unchanged, %d skipped.',
                (int) ($import['created'] ?? 0),
                (int) ($import['updated'] ?? 0),
                (int) ($import['unchanged'] ?? 0),
                (int) ($import['skipped'] ?? 0)
            ),
            'import'  => [
                'created'   => (int) ($import['created'] ?? 0),
                'updated'   => (int) ($import['updated'] ?? 0),
                'unchanged' => (int) ($import['unchanged'] ?? 0),
                'skipped'   => (int) ($import['skipped'] ?? 0),
                'areas'     => $import['areas'] ?? [],
            ],
            'reward'  => $rewardPaymentItem ? [
                'payment_item_id'      => $rewardPaymentItem->id,
                'total_amount'         => $rewardPaymentItem->total_amount,
                'new_ds_count'         => $rewardPaymentItem->meta['new_ds_count'] ?? 0,
                'new_af_count'         => $rewardPaymentItem->meta['new_af_count'] ?? 0,
                'updated_ds_count'     => $rewardPaymentItem->meta['updated_ds_count'] ?? 0,
                'updated_af_count'     => $rewardPaymentItem->meta['updated_af_count'] ?? 0,
                'communication_prefix' => $rewardPaymentItem->meta['communication_prefix'] ?? null,
                'breakdown'            => $rewardPaymentItem->meta['breakdown'] ?? [],
            ] : null,
            'log'     => $this->formatLog($importLog->fresh()),
            'history' => [
                'events_seen'    => data_get($historyResult, 'history.events_seen'),
                'events_matched' => data_get($historyResult, 'history.events_matched'),
                'pages'          => count($historyResult['pages'] ?? []),
            ],
        ]);
    }

    private function formatLog(SwcMemberImportLog $log): array
    {
        $user = $log->relationLoaded('user') ? $log->user : $log->user()->first(['id', 'swc_handle', 'discord_global_name', 'discord_username']);
        $handle = trim((string) ($user?->swc_handle ?? $user?->discord_global_name ?? $user?->discord_username ?? '')) ?: null;

        return [
            'id'               => $log->id,
            'user_id'          => $log->user_id,
            'handle'           => $handle,
            'created_at'       => $log->created_at?->toISOString(),
            'events_seen'      => $log->events_seen,
            'events_matched'   => $log->events_matched,
            'created'          => $log->created,
            'updated'          => $log->updated,
            'unchanged'        => $log->unchanged,
            'skipped'          => $log->skipped,
            'areas'            => $log->areas ?? [],
            'reward_breakdown' => $log->reward_breakdown ?? null,
        ];
    }
}
