<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CellAnnotationController extends Controller
{
    private const INDEX_CACHE_TTL_SECONDS = 120;
    private const CACHE_VERSION_KEY = 'universe:cell-annotations:version';

    public function index(Request $request): JsonResponse
    {
        if (!Permissions::hasAny($request->user(), ['can_view_asteroid_intel', 'is_admin', 'is_sysadmin'])) {
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

        if (!$hasSectorUid && !$hasBounds) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $bounds = $hasBounds
            ? [
                'min_galx' => min((int) $data['min_galx'], (int) $data['max_galx']),
                'max_galx' => max((int) $data['min_galx'], (int) $data['max_galx']),
                'min_galy' => min((int) $data['min_galy'], (int) $data['max_galy']),
                'max_galy' => max((int) $data['min_galy'], (int) $data['max_galy']),
            ]
            : null;

        $cacheKey = $this->buildIndexCacheKey($data, $bounds);
        $annotations = Cache::remember($cacheKey, self::INDEX_CACHE_TTL_SECONDS, function () use ($hasSectorUid, $data, $bounds) {
            return SwcSectorCellAnnotation::query()
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

        if ($markerType === null && $label === null && $notes === null) {
            $existing = SwcSectorCellAnnotation::query()
                ->where('sector_uid', (string) $data['sector_uid'])
                ->where('galx', (int) $data['galx'])
                ->where('galy', (int) $data['galy'])
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
