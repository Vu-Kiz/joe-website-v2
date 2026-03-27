<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use App\Support\Admin\AdminActionLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CellAnnotationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sector_uid' => ['required', 'string', 'max:255'],
        ]);

        $annotations = SwcSectorCellAnnotation::query()
            ->where('sector_uid', (string) $data['sector_uid'])
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
}
