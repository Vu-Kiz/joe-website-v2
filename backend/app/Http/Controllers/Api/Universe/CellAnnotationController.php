<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcSector;
use App\Models\Swc\SwcSectorCellAnnotation;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\Auth\Permissions;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CellAnnotationController extends Controller
{
    private const INDEX_CACHE_TTL_SECONDS = 120;
    private const CACHE_VERSION_KEY = 'universe:cell-annotations:version';

    public function __construct(protected ToolAccessService $toolAccessService) {}

    private function isSubscriber(Request $request): bool
    {
        $user = $request->user();
        return $user && $this->toolAccessService->tierForUser($user) === 'public';
    }

    /** Returns ['user_id' => int|null, 'faction_id' => int|null] for scoping subscriber notes. */
    private function resolveOwner(Request $request): array
    {
        $user = $request->user();
        $sub = $this->toolAccessService->activeSubscriptionFor($user);

        if ($sub && $sub->subscriber_type === 'faction') {
            return ['user_id' => null, 'faction_id' => (int) $sub->subscriber_id];
        }

        return ['user_id' => $user->id, 'faction_id' => null];
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isSubscriber = $this->isSubscriber($request);

        if (!$isSubscriber && !Permissions::hasAny($user, ['can_view_asteroid_intel', 'is_joe_member', 'is_admin', 'is_sysadmin'])) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $data = $request->validate([
            'sector_uid' => ['nullable', 'string', 'max:255'],
            'min_galx' => ['nullable', 'integer'],
            'max_galx' => ['nullable', 'integer'],
            'min_galy' => ['nullable', 'integer'],
            'max_galy' => ['nullable', 'integer'],
        ]);

        $hasSectorUid = !empty($data['sector_uid']);
        $hasBounds = isset($data['min_galx'], $data['max_galx'], $data['min_galy'], $data['max_galy']);

        $bounds = $hasBounds
            ? [
                'min_galx' => min((int) $data['min_galx'], (int) $data['max_galx']),
                'max_galx' => max((int) $data['min_galx'], (int) $data['max_galx']),
                'min_galy' => min((int) $data['min_galy'], (int) $data['max_galy']),
                'max_galy' => max((int) $data['min_galy'], (int) $data['max_galy']),
            ]
            : null;

        // Subscriber queries are owner-scoped and support a no-filter "fetch all" for init load.
        // JOE member queries always require a bounds/sector filter (large dataset).
        if ($isSubscriber) {
            $owner = $this->resolveOwner($request);
            $annotations = SwcSectorCellAnnotation::query()
                ->where('owner_user_id', $owner['user_id'])
                ->where('owner_faction_id', $owner['faction_id'])
                ->when($hasSectorUid, fn ($q) => $q->where('sector_uid', (string) $data['sector_uid']))
                ->when($bounds !== null, fn ($q) => $q
                    ->whereBetween('galx', [$bounds['min_galx'], $bounds['max_galx']])
                    ->whereBetween('galy', [$bounds['min_galy'], $bounds['max_galy']]))
                ->orderBy('galy')->orderBy('galx')
                ->get(['id', 'sector_uid', 'galx', 'galy', 'marker_type', 'label', 'notes', 'created_at', 'updated_at']);

            return response()->json(['ok' => true, 'data' => $annotations]);
        }

        // JOE member path — require at least a bounds or sector filter to avoid unbounded scans.
        if (!$hasSectorUid && !$hasBounds) {
            return response()->json(['ok' => true, 'data' => []]);
        }

        $cacheKey = $this->buildIndexCacheKey($data, $bounds);
        $annotations = Cache::remember($cacheKey, self::INDEX_CACHE_TTL_SECONDS, function () use ($hasSectorUid, $data, $bounds) {
            return SwcSectorCellAnnotation::query()
                ->whereNull('owner_user_id')
                ->whereNull('owner_faction_id')
                ->when($hasSectorUid, function ($query) use ($data) {
                    $query->where('sector_uid', (string) $data['sector_uid']);
                })
                ->when($bounds !== null, function ($query) use ($bounds) {
                    $query
                        ->whereBetween('galx', [$bounds['min_galx'], $bounds['max_galx']])
                        ->whereBetween('galy', [$bounds['min_galy'], $bounds['max_galy']]);
                })
                ->orderBy('galy')
                ->orderBy('galx')
                ->get([
                    'id',
                    'sector_uid',
                    'galx',
                    'galy',
                    'marker_type',
                    'label',
                    'notes',
                    'created_at',
                    'updated_at',
                ]);
        });

        return response()->json([
            'ok' => true,
            'data' => $annotations,
        ]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sector_uid' => ['required', 'string', 'max:255'],
            'galx' => ['required', 'integer'],
            'galy' => ['required', 'integer'],
            'marker_type' => ['nullable', 'string', 'max:40'],
            'label' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $markerType = trim((string) ($data['marker_type'] ?? '')) ?: null;
        $label = trim((string) ($data['label'] ?? '')) ?: null;
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        $isSubscriber = $this->isSubscriber($request);
        $owner = $isSubscriber ? $this->resolveOwner($request) : ['user_id' => null, 'faction_id' => null];
        $ownerUserId = $owner['user_id'];
        $ownerFactionId = $owner['faction_id'];

        if ($markerType === null && $label === null && $notes === null) {
            $existing = SwcSectorCellAnnotation::query()
                ->where('sector_uid', (string) $data['sector_uid'])
                ->where('galx', (int) $data['galx'])
                ->where('galy', (int) $data['galy'])
                ->where('owner_user_id', $ownerUserId)
                ->where('owner_faction_id', $ownerFactionId)
                ->first();

            if ($existing) {
                $before = $existing->only([
                    'id',
                    'sector_uid',
                    'galx',
                    'galy',
                    'marker_type',
                    'label',
                    'notes',
                    'created_by',
                    'updated_by',
                ]);

                $existing->delete();

                AdminActionLogger::log(
                    $request,
                    'galaxy',
                    'clear_grid_note',
                    sprintf(
                        'Cleared grid note at %s (%d, %d).',
                        (string) $data['sector_uid'],
                        (int) $data['galx'],
                        (int) $data['galy']
                    ),
                    'swc_sector_cell_annotation',
                    $before['id'] ?? null,
                    $before,
                    null
                );

                $this->bumpCacheVersion();
            }

            return response()->json([
                'ok' => true,
                'message' => 'Sector cell annotation cleared.',
                'data' => null,
            ]);
        }

        $sector = SwcSector::query()
            ->where('uid', (string) $data['sector_uid'])
            ->first();

        $existing = SwcSectorCellAnnotation::query()
            ->where('sector_uid', (string) $data['sector_uid'])
            ->where('galx', (int) $data['galx'])
            ->where('galy', (int) $data['galy'])
            ->where('owner_user_id', $ownerUserId)
            ->first();

        $before = $existing?->only([
            'id',
            'sector_uid',
            'galx',
            'galy',
            'marker_type',
            'label',
            'notes',
            'created_by',
            'updated_by',
        ]);

        $annotation = SwcSectorCellAnnotation::updateOrCreate(
            [
                'sector_uid' => (string) $data['sector_uid'],
                'galx' => (int) $data['galx'],
                'galy' => (int) $data['galy'],
                'owner_user_id' => $ownerUserId,
                'owner_faction_id' => $ownerFactionId,
            ],
            [
                'sector_id' => $sector?->id,
                'marker_type' => $markerType,
                'label' => $label,
                'notes' => $notes,
                'created_by' => auth()->id(),
                'updated_by' => auth()->id(),
            ]
        );

        $after = $annotation->only([
            'id',
            'sector_uid',
            'galx',
            'galy',
            'marker_type',
            'label',
            'notes',
            'created_by',
            'updated_by',
        ]);

        $action = $before ? 'update_grid_note' : 'create_grid_note';
        $summary = $before
            ? sprintf(
                'Updated grid note at %s (%d, %d).',
                (string) $data['sector_uid'],
                (int) $data['galx'],
                (int) $data['galy']
            )
            : sprintf(
                'Created grid note at %s (%d, %d).',
                (string) $data['sector_uid'],
                (int) $data['galx'],
                (int) $data['galy']
            );

        AdminActionLogger::log(
            $request,
            'galaxy',
            $action,
            $summary,
            'swc_sector_cell_annotation',
            $annotation->id,
            $before,
            $after
        );

        $this->bumpCacheVersion();

        return response()->json([
            'ok' => true,
            'message' => 'Sector cell annotation saved.',
            'data' => $annotation->only([
                'id',
                'sector_uid',
                'galx',
                'galy',
                'marker_type',
                'label',
                'notes',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    private function buildIndexCacheKey(array $data, ?array $bounds): string
    {
        $version = (int) Cache::get(self::CACHE_VERSION_KEY, 1);

        return sprintf(
            'universe:cell-annotations:index:v%d:%s',
            $version,
            md5(json_encode([
                'sector_uid' => $data['sector_uid'] ?? null,
                'bounds' => $bounds,
            ], JSON_THROW_ON_ERROR))
        );
    }

    private function bumpCacheVersion(): void
    {
        Cache::forever(self::CACHE_VERSION_KEY, ((int) Cache::get(self::CACHE_VERSION_KEY, 1)) + 1);
    }
}
