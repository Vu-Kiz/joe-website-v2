<?php

namespace App\Http\Controllers\Api\Sys;

use App\Http\Controllers\Controller;
use App\Models\SwcSector;
use App\Models\SwcSectorCellAnnotation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SectorCellAnnotationController extends Controller
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
            SwcSectorCellAnnotation::query()
                ->where('sector_uid', (string) $data['sector_uid'])
                ->where('galx', (int) $data['galx'])
                ->where('galy', (int) $data['galy'])
                ->delete();

            return response()->json([
                'ok' => true,
                'message' => 'Sector cell annotation cleared.',
                'data' => null,
            ]);
        }

        $sector = SwcSector::query()
            ->where('uid', (string) $data['sector_uid'])
            ->first();

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
