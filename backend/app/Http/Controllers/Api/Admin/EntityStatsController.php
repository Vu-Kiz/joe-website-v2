<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\Admin\AdminActionLogger;
use App\Support\Universe\EntityStatsCsvTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EntityStatsController extends Controller
{
    use EntityStatsCsvTrait;
    public function exportCsv(Request $request, string $entityType): StreamedResponse
    {
        $config = $this->resolveEntityConfig($entityType);
        $columns = $config['select'];
        $filename = str_replace(' ', '-', $entityType) . '-entity-stats-' . now()->format('Y-m-d_His') . '.csv';

        AdminActionLogger::log(
            $request,
            'universe_entity_stats',
            'export_csv',
            'Exported stored ' . $config['label'] . ' catalog as CSV',
            $config['target_type'],
            null,
            null,
            [
                'entity_type' => $entityType,
                'column_count' => count($columns),
            ]
        );

        return response()->streamDownload(function () use ($config, $columns): void {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_map(
                fn (string $column): string => $this->normalizeCsvHeader($column),
                $columns
            ));

            $config['model']::query()
                ->select($columns)
                ->orderByRaw('COALESCE(name, uid) asc')
                ->chunk(250, function ($records) use ($handle, $columns): void {
                    foreach ($records as $record) {
                        $row = [];

                        foreach ($columns as $column) {
                            $row[] = $this->normalizeCsvValue($column, $record->{$column} ?? null);
                        }

                        fputcsv($handle, $row);
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function populateStationIcons(Request $request): JsonResponse
    {
        $updated = 0;
        $skipped = 0;

        SwcStationType::query()
            ->get(['id', 'uid', 'icon_url'])
            ->each(function (SwcStationType $type) use (&$updated, &$skipped): void {
                if (!preg_match('/^\d+:(\d+)$/', (string) $type->uid, $matches)) {
                    $skipped++;
                    return;
                }

                $iconUrl = 'https://images.swcombine.com//stations/' . $matches[1] . '/small.gif';

                if ($type->icon_url === $iconUrl) {
                    $skipped++;
                    return;
                }

                $type->icon_url = $iconUrl;
                $type->save();
                $updated++;
            });

        AdminActionLogger::log(
            $request,
            'universe_entity_stats',
            'populate_station_icons',
            'Populated station icon URLs from SWC station UID values',
            'swc_station_type',
            null,
            null,
            [
                'updated' => $updated,
                'skipped' => $skipped,
                'format' => 'https://images.swcombine.com//stations/{uid_without_prefix}/small.gif',
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Station icons populated.',
            'data' => [
                'updated' => $updated,
                'skipped' => $skipped,
            ],
        ]);
    }

    public function populateMaterialIcons(Request $request): JsonResponse
    {
        $updated = 0;
        $skipped = 0;

        SwcMaterialType::query()
            ->get(['id', 'uid', 'icon_url'])
            ->each(function (SwcMaterialType $type) use (&$updated, &$skipped): void {
                if (!preg_match('/^\d+:(\d+)$/', (string) $type->uid, $matches)) {
                    $skipped++;
                    return;
                }

                $iconUrl = 'https://images.swcombine.com//materials/' . $matches[1] . '/small.gif';

                if ($type->icon_url === $iconUrl) {
                    $skipped++;
                    return;
                }

                $type->icon_url = $iconUrl;
                $type->save();
                $updated++;
            });

        AdminActionLogger::log(
            $request,
            'universe_entity_stats',
            'populate_material_icons',
            'Populated material icon URLs from SWC material UID values',
            'swc_material_type',
            null,
            null,
            [
                'updated' => $updated,
                'skipped' => $skipped,
                'format' => 'https://images.swcombine.com//materials/{uid_without_prefix}/small.gif',
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Material icons populated.',
            'data' => [
                'updated' => $updated,
                'skipped' => $skipped,
            ],
        ]);
    }

    public function update(Request $request, string $entityType, string $entityId): JsonResponse
    {
        $config = $this->resolveEntityConfig($entityType);
        /** @var Model $record */
        $record = $config['model']::query()
            ->where('uid', $entityId)
            ->orWhere('name', $entityId)
            ->firstOrFail();

        $payload = $request->validate([
            'data' => ['required', 'array'],
        ]);

        $input = collect($payload['data'] ?? [])
            ->only($config['editable'])
            ->toArray();

        if (array_key_exists('shield_arcs', $input)) {
            if (!$request->user()?->is_sysadmin) {
                abort(403, 'Only sysadmins can modify shield arcs.');
            }

            $input['shield_arcs'] = collect(is_array($input['shield_arcs']) ? $input['shield_arcs'] : [])
                ->map(function ($arc) {
                    if (!is_array($arc)) {
                        return null;
                    }

                    $name = trim((string) ($arc['name'] ?? ''));
                    $value = $arc['value'] ?? null;
                    $percent = $arc['percent'] ?? null;

                    return [
                        'name' => $name !== '' ? $name : null,
                        'value' => is_numeric($value) ? (int) round((float) $value) : null,
                        'percent' => is_numeric($percent) ? round((float) $percent, 2) : null,
                    ];
                })
                ->filter(fn ($arc) => is_array($arc) && ($arc['name'] !== null || $arc['value'] !== null || $arc['percent'] !== null))
                ->values()
                ->all();
        }

        $before = collect($config['editable'])
            ->mapWithKeys(fn (string $field) => [$field => $record->{$field}])
            ->toArray();

        $record->fill($input);
        $record->save();

        $afterRecord = $config['model']::query()
            ->select($config['select'])
            ->findOrFail($record->getKey());

        $after = collect($config['editable'])
            ->filter(fn (string $field) => array_key_exists($field, $input))
            ->mapWithKeys(fn (string $field) => [$field => $afterRecord->{$field}])
            ->toArray();

        AdminActionLogger::log(
            $request,
            'universe_entity_stats',
            'update',
            'Updated stored ' . $config['label'] . ' record',
            $config['target_type'],
            $record->getKey(),
            $before,
            $after
        );

        return response()->json([
            'ok' => true,
            'message' => ucfirst($config['label']) . ' updated.',
            'data' => $afterRecord,
        ]);
    }

}
