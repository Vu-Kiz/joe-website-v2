<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Support\Universe\EntityStatsCsvTrait;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UniverseEntityStatsController extends Controller
{
    use EntityStatsCsvTrait;

    public function exportCsv(Request $request, string $entityType): StreamedResponse
    {
        $config = $this->resolveEntityConfig($entityType);

        $excludeFromScalar = ['payload', 'materials', 'weapons', 'images', 'image_url', 'icon_url', 'description', 'last_pulled_at'];
        $scalarColumns = array_values(array_filter(
            $config['select'],
            fn (string $col): bool => !in_array($col, $excludeFromScalar, true)
        ));

        $hasMaterials = in_array('materials', $config['select'], true);
        $hasWeapons = in_array('weapons', $config['select'], true);
        $hasLastPulled = in_array('last_pulled_at', $config['select'], true);

        $allMaterialNames = [];
        $allWeaponNames = [];

        if ($hasMaterials || $hasWeapons) {
            $fetchColumns = array_values(array_filter(
                ['materials', 'weapons'],
                fn (string $col): bool => in_array($col, $config['select'], true)
            ));

            $config['model']::query()
                ->select($fetchColumns)
                ->chunk(500, function ($records) use (&$allMaterialNames, &$allWeaponNames, $hasMaterials, $hasWeapons): void {
                    foreach ($records as $record) {
                        if ($hasMaterials && is_array($record->materials)) {
                            foreach ($record->materials as $material) {
                                $name = $material['name'] ?? null;
                                if ($name && !in_array($name, $allMaterialNames, true)) {
                                    $allMaterialNames[] = $name;
                                }
                            }
                        }

                        if ($hasWeapons && is_array($record->weapons)) {
                            foreach ($record->weapons as $weapon) {
                                $name = $weapon['name'] ?? null;
                                if ($name && !in_array($name, $allWeaponNames, true)) {
                                    $allWeaponNames[] = $name;
                                }
                            }
                        }
                    }
                });

            sort($allMaterialNames);
            sort($allWeaponNames);
        }

        $filename = str_replace(' ', '-', $entityType) . '-entity-stats-' . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($config, $scalarColumns, $allMaterialNames, $allWeaponNames, $hasMaterials, $hasWeapons, $hasLastPulled): void {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                return;
            }

            $headers = array_map(fn (string $col): string => $this->normalizeCsvHeader($col), $scalarColumns);
            foreach ($allMaterialNames as $name) {
                $headers[] = $name;
            }
            foreach ($allWeaponNames as $name) {
                $headers[] = $name;
            }
            if ($hasLastPulled) {
                $headers[] = 'Last Pulled';
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headers);

            $fetchColumns = $scalarColumns;
            if ($hasMaterials) {
                $fetchColumns[] = 'materials';
            }
            if ($hasWeapons) {
                $fetchColumns[] = 'weapons';
            }
            if ($hasLastPulled) {
                $fetchColumns[] = 'last_pulled_at';
            }

            $config['model']::query()
                ->select($fetchColumns)
                ->orderByRaw('COALESCE(name, uid) asc')
                ->chunk(250, function ($records) use ($handle, $scalarColumns, $allMaterialNames, $allWeaponNames, $hasMaterials, $hasWeapons, $hasLastPulled): void {
                    foreach ($records as $record) {
                        $row = [];

                        foreach ($scalarColumns as $column) {
                            $row[] = $this->normalizeCsvValue($column, $record->{$column} ?? null);
                        }

                        if ($hasMaterials) {
                            $materials = is_array($record->materials) ? $record->materials : [];
                            $materialMap = [];
                            foreach ($materials as $material) {
                                $name = $material['name'] ?? null;
                                if ($name) {
                                    $qty = $material['quantity'] ?? $material['amount'] ?? $material['count'] ?? null;
                                    $materialMap[$name] = $qty !== null && $qty !== '' ? (string) $qty : '1';
                                }
                            }
                            foreach ($allMaterialNames as $name) {
                                $row[] = $materialMap[$name] ?? '';
                            }
                        }

                        if ($hasWeapons) {
                            $weapons = is_array($record->weapons) ? $record->weapons : [];
                            $weaponMap = [];
                            foreach ($weapons as $weapon) {
                                $name = $weapon['name'] ?? null;
                                if (!$name) {
                                    continue;
                                }

                                $qty = $weapon['quantity'] ?? null;
                                $arc = $weapon['arc'] ?? null;
                                $parts = [];
                                if ($qty !== null && $qty !== '') {
                                    $parts[] = 'Qty ' . $qty;
                                }
                                if ($arc) {
                                    $parts[] = 'Arc ' . $arc;
                                }
                                $entry = implode(' | ', $parts) ?: '1';

                                if (isset($weaponMap[$name])) {
                                    $weaponMap[$name] .= '; ' . $entry;
                                } else {
                                    $weaponMap[$name] = $entry;
                                }
                            }
                            foreach ($allWeaponNames as $name) {
                                $row[] = $weaponMap[$name] ?? '';
                            }
                        }

                        if ($hasLastPulled) {
                            $raw = $record->last_pulled_at ?? null;
                            $row[] = $raw ? \Carbon\Carbon::parse($raw)->format('d/m/Y') : '';
                        }

                        fputcsv($handle, $row);
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
