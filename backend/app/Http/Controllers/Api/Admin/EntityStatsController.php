<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SwcFacilityType;
use App\Models\SwcCreatureType;
use App\Models\SwcDroidType;
use App\Models\SwcItemType;
use App\Models\SwcMaterialType;
use App\Models\SwcNpcType;
use App\Models\SwcPlanetType;
use App\Models\SwcRace;
use App\Models\SwcShipType;
use App\Models\SwcStationType;
use App\Models\SwcTerrainType;
use App\Models\SwcVehicleType;
use App\Models\SwcWeaponType;
use App\Support\Admin\AdminActionLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EntityStatsController extends Controller
{
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

    /**
     * @return array{
     *   label: string,
     *   model: class-string<Model>,
     *   editable: array<int, string>,
     *   select: array<int, string>
     * }
     */
    protected function resolveEntityConfig(string $entityType): array
    {
        return match ($entityType) {
            'station' => [
                'label' => 'station type',
                'target_type' => 'swc_station_type',
                'model' => SwcStationType::class,
                'editable' => [
                    'name',
                    'length',
                    'description',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_passengers',
                    'escape_pods',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_produce',
                    'is_asteroid_mining_depot',
                    'can_refine_alazhi',
                    'can_interdict',
                    'can_research',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'length',
                    'description',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_passengers',
                    'escape_pods',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_produce',
                    'is_asteroid_mining_depot',
                    'can_refine_alazhi',
                    'can_interdict',
                    'can_research',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'terrain' => [
                'label' => 'terrain type',
                'target_type' => 'swc_terrain_type',
                'model' => SwcTerrainType::class,
                'editable' => [
                    'name',
                    'code',
                    'material_probability_percent',
                    'material_types',
                    'images',
                    'description',
                    'image_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'code',
                    'material_probability_percent',
                    'material_types',
                    'images',
                    'description',
                    'image_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'material' => [
                'label' => 'material type',
                'target_type' => 'swc_material_type',
                'model' => SwcMaterialType::class,
                'editable' => [
                    'name',
                    'description',
                    'weight_tonnes',
                    'volume_m3',
                    'rarity',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'description',
                    'weight_tonnes',
                    'volume_m3',
                    'rarity',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'facility' => [
                'label' => 'facility type',
                'target_type' => 'swc_facility_type',
                'model' => SwcFacilityType::class,
                'editable' => [
                    'name',
                    'class_uid',
                    'class_name',
                    'size',
                    'sensors',
                    'weight_tonnes',
                    'volume_m3',
                    'volume_capacity_m3',
                    'max_passengers',
                    'flat_count',
                    'job_count',
                    'size_x',
                    'size_y',
                    'length',
                    'width',
                    'height',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'energy',
                    'can_load_materials',
                    'can_earn_income',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_produce',
                    'can_mine',
                    'can_refine_alazhi',
                    'can_farm_alazhi',
                    'can_research',
                    'description',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_uid',
                    'class_name',
                    'size',
                    'sensors',
                    'weight_tonnes',
                    'volume_m3',
                    'volume_capacity_m3',
                    'max_passengers',
                    'flat_count',
                    'job_count',
                    'size_x',
                    'size_y',
                    'length',
                    'width',
                    'height',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'energy',
                    'can_load_materials',
                    'can_earn_income',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_produce',
                    'can_mine',
                    'can_refine_alazhi',
                    'can_farm_alazhi',
                    'can_research',
                    'description',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'planet' => [
                'label' => 'planet type',
                'target_type' => 'swc_planet_type',
                'model' => SwcPlanetType::class,
                'editable' => [
                    'name',
                    'description',
                    'images',
                    'image_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'description',
                    'images',
                    'image_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'item' => [
                'label' => 'item type',
                'target_type' => 'swc_item_type',
                'model' => SwcItemType::class,
                'editable' => [
                    'name',
                    'class_uid',
                    'class_name',
                    'description',
                    'weight_tonnes',
                    'volume_m3',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_uid',
                    'class_name',
                    'description',
                    'weight_tonnes',
                    'volume_m3',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'ship' => [
                'label' => 'ship type',
                'target_type' => 'swc_ship_type',
                'model' => SwcShipType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'length',
                    'manoeuvrability',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_speed',
                    'hyperdrive',
                    'max_passengers',
                    'escape_pods',
                    'hull',
                    'shield',
                    'shield_arcs',
                    'armour',
                    'ionic_capacity',
                    'has_repulsors',
                    'slot_size',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_interdict',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'length',
                    'manoeuvrability',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_speed',
                    'hyperdrive',
                    'max_passengers',
                    'escape_pods',
                    'hull',
                    'shield',
                    'shield_arcs',
                    'armour',
                    'ionic_capacity',
                    'has_repulsors',
                    'slot_size',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'can_interdict',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'vehicle' => [
                'label' => 'vehicle type',
                'target_type' => 'swc_vehicle_type',
                'model' => SwcVehicleType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'length',
                    'manoeuvrability',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_speed',
                    'max_passengers',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'has_repulsors',
                    'slot_size',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'terrain_restrictions',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'length',
                    'manoeuvrability',
                    'sensors',
                    'ecm',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'max_speed',
                    'max_passengers',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'has_repulsors',
                    'slot_size',
                    'medical_rooms',
                    'has_hangar_bay',
                    'has_docking_bay',
                    'can_recycle',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'terrain_restrictions',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'droid' => [
                'label' => 'droid type',
                'target_type' => 'swc_droid_type',
                'model' => SwcDroidType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'sensors',
                    'ecm',
                    'batch_quantity',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'armour',
                    'slot_size',
                    'terrain_restrictions',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'skills',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'sensors',
                    'ecm',
                    'batch_quantity',
                    'weight_tonnes',
                    'volume_m3',
                    'weight_capacity_tonnes',
                    'volume_capacity_m3',
                    'hull',
                    'shield',
                    'ionic_capacity',
                    'armour',
                    'slot_size',
                    'terrain_restrictions',
                    'price_credits',
                    'production_modifier',
                    'recommended_workers',
                    'recycling_xp',
                    'generic_slots',
                    'skills',
                    'weapons',
                    'materials',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'npc' => [
                'label' => 'npc type',
                'target_type' => 'swc_npc_type',
                'model' => SwcNpcType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'price_credits',
                    'hiring_locations',
                    'skills',
                    'images',
                    'image_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'price_credits',
                    'hiring_locations',
                    'skills',
                    'images',
                    'image_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'race' => [
                'label' => 'race',
                'target_type' => 'swc_race',
                'model' => SwcRace::class,
                'editable' => [
                    'name',
                    'description',
                    'force_probability',
                    'hp_bonus',
                    'hp_multiplier',
                    'homeworld_uid',
                    'homeworld_name',
                    'homeworld_href',
                    'skills',
                    'terrain_restrictions',
                    'images',
                    'image_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'description',
                    'force_probability',
                    'hp_bonus',
                    'hp_multiplier',
                    'homeworld_uid',
                    'homeworld_name',
                    'homeworld_href',
                    'skills',
                    'terrain_restrictions',
                    'images',
                    'image_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'weapon' => [
                'label' => 'weapon type',
                'target_type' => 'swc_weapon_type',
                'model' => SwcWeaponType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'damage_type',
                    'min_damage',
                    'max_damage',
                    'optimum_range',
                    'max_hits',
                    'drop_off',
                    'firepower',
                    'tracking',
                    'is_poison',
                    'is_dual',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'damage_type',
                    'min_damage',
                    'max_damage',
                    'optimum_range',
                    'max_hits',
                    'drop_off',
                    'firepower',
                    'tracking',
                    'is_poison',
                    'is_dual',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            'creature' => [
                'label' => 'creature type',
                'target_type' => 'swc_creature_type',
                'model' => SwcCreatureType::class,
                'editable' => [
                    'name',
                    'class_name',
                    'description',
                    'slot_size',
                    'species',
                    'base_hp',
                    'weight_tonnes',
                    'volume_m3',
                    'homeworld_uid',
                    'homeworld_name',
                    'homeworld_href',
                    'spawn_terrain_types',
                    'terrain_restrictions',
                    'skills',
                    'weapons',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                ],
                'select' => [
                    'uid',
                    'name',
                    'class_name',
                    'description',
                    'slot_size',
                    'species',
                    'base_hp',
                    'weight_tonnes',
                    'volume_m3',
                    'homeworld_uid',
                    'homeworld_name',
                    'homeworld_href',
                    'spawn_terrain_types',
                    'terrain_restrictions',
                    'skills',
                    'weapons',
                    'price_credits',
                    'images',
                    'image_url',
                    'icon_url',
                    'payload',
                    'last_pulled_at',
                ],
            ],
            default => abort(404),
        };
    }

    protected function normalizeCsvValue(string $column, mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        if (is_array($value)) {
            return $this->normalizeCsvArrayValue($column, $value);
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    }

    protected function normalizeCsvArrayValue(string $column, array $value): string
    {
        if ($value === []) {
            return '';
        }

        $lines = match ($column) {
            'weapons' => array_map(fn (mixed $entry): string => $this->formatWeaponCsvLine($entry), $value),
            'shield_arcs' => array_map(fn (mixed $entry): string => $this->formatShieldArcCsvLine($entry), $value),
            'materials' => array_map(fn (mixed $entry): string => $this->formatNamedQuantityCsvLine($entry), $value),
            'material_types', 'terrain_restrictions', 'spawn_terrain_types', 'hiring_locations' => array_map(
                fn (mixed $entry): string => $this->formatNamedEntryCsvLine($entry),
                $value
            ),
            'skills' => array_map(fn (mixed $entry): string => $this->formatSkillCsvLine($entry), $value),
            'images' => $this->formatImagesCsvLines($value),
            default => array_map(
                fn (mixed $entry): string => is_array($entry)
                    ? (json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '')
                    : (string) $entry,
                $value
            ),
        };

        return collect($lines)
            ->filter(fn (string $line): bool => trim($line) !== '')
            ->values()
            ->implode("\n");
    }

    protected function formatWeaponCsvLine(mixed $entry): string
    {
        if (!is_array($entry)) {
            return is_scalar($entry) ? (string) $entry : '';
        }

        $name = trim((string) ($entry['name'] ?? $entry['value'] ?? 'Weapon'));
        $parts = [$name];

        if (($entry['quantity'] ?? null) !== null && $entry['quantity'] !== '') {
            $parts[] = 'Qty ' . $entry['quantity'];
        }

        if (!empty($entry['arc'])) {
            $parts[] = 'Arc ' . $entry['arc'];
        }

        if (($entry['arc_from'] ?? null) !== null && $entry['arc_from'] !== '') {
            $parts[] = 'From ' . $entry['arc_from'];
        }

        if (($entry['arc_to'] ?? null) !== null && $entry['arc_to'] !== '') {
            $parts[] = 'To ' . $entry['arc_to'];
        }

        return implode(' | ', $parts);
    }

    protected function formatShieldArcCsvLine(mixed $entry): string
    {
        if (!is_array($entry)) {
            return is_scalar($entry) ? (string) $entry : '';
        }

        $name = trim((string) ($entry['name'] ?? $entry['arc'] ?? 'Shield Arc'));
        $parts = [$name];

        if (($entry['value'] ?? null) !== null && $entry['value'] !== '') {
            $parts[] = 'Deflectors ' . $entry['value'];
        }

        if (($entry['percent'] ?? null) !== null && $entry['percent'] !== '') {
            $parts[] = $entry['percent'] . '%';
        }

        return implode(' | ', $parts);
    }

    protected function formatNamedQuantityCsvLine(mixed $entry): string
    {
        if (!is_array($entry)) {
            return is_scalar($entry) ? (string) $entry : '';
        }

        $name = trim((string) ($entry['name'] ?? $entry['value'] ?? 'Entry'));
        $quantity = $entry['quantity'] ?? $entry['amount'] ?? $entry['count'] ?? null;

        return $quantity !== null && $quantity !== ''
            ? $name . ' | Qty ' . $quantity
            : $name;
    }

    protected function formatNamedEntryCsvLine(mixed $entry): string
    {
        if (!is_array($entry)) {
            return is_scalar($entry) ? (string) $entry : '';
        }

        return trim((string) ($entry['name'] ?? $entry['value'] ?? $entry['class_name'] ?? 'Entry'));
    }

    protected function formatSkillCsvLine(mixed $entry): string
    {
        if (!is_array($entry)) {
            return is_scalar($entry) ? (string) $entry : '';
        }

        $name = trim((string) ($entry['name'] ?? $entry['skill'] ?? $entry['value'] ?? 'Skill'));
        $level = $entry['value'] ?? $entry['level'] ?? $entry['amount'] ?? null;

        return $level !== null && $level !== ''
            ? $name . ' | ' . $level
            : $name;
    }

    protected function formatImagesCsvLines(array $value): array
    {
        $lines = [];

        foreach ($value as $key => $entry) {
            if (is_string($key) && is_scalar($entry)) {
                $lines[] = str($key)->replace('_', ' ')->title()->toString() . ' | ' . $entry;
                continue;
            }

            if (is_scalar($entry)) {
                $lines[] = (string) $entry;
                continue;
            }

            if (is_array($entry)) {
                $lines[] = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
            }
        }

        return $lines;
    }

    protected function normalizeCsvHeader(string $column): string
    {
        return match ($column) {
            'uid' => 'UID',
            'class_uid' => 'Class UID',
            'class_name' => 'Class',
            'code' => 'Code',
            'description' => 'Description',
            'weapons' => 'Linked Weapons',
            'shield_arcs' => 'Shield Arcs',
            'shield' => 'Deflectors',
            'ionic_capacity' => 'Ionic Capacity',
            'max_speed' => 'Max Speed',
            'hyperdrive' => 'Hyperspeed',
            'manoeuvrability' => 'Manoeuvrability',
            'weight_tonnes' => 'Weight (Tonnes)',
            'volume_m3' => 'Volume (m3)',
            'weight_capacity_tonnes' => 'Weight Capacity (Tonnes)',
            'volume_capacity_m3' => 'Volume Capacity (m3)',
            'max_passengers' => 'Max Passengers',
            'escape_pods' => 'Escape Pods',
            'medical_rooms' => 'Medical Rooms',
            'generic_slots' => 'Generic Slots',
            'price_credits' => 'Raw Value (Credits)',
            'production_modifier' => 'Production Modifier',
            'recommended_workers' => 'Recommended Workers',
            'recycling_xp' => 'Recycling XP',
            'material_probability_percent' => 'Material Probability (%)',
            'material_types' => 'Material Types',
            'materials' => 'Raw Materials',
            'images' => 'Images',
            'image_url' => 'Main Image URL',
            'icon_url' => 'Icon URL',
            'payload' => 'Payload',
            'last_pulled_at' => 'Last Pulled At',
            'homeworld_uid' => 'Homeworld UID',
            'homeworld_name' => 'Homeworld',
            'homeworld_href' => 'Homeworld Link',
            'spawn_terrain_types' => 'Spawn Terrain Types',
            'terrain_restrictions' => 'Terrain Restrictions',
            'skills' => 'Skills',
            'species' => 'Species',
            'slot_size' => 'Party Slot',
            'flat_count' => 'Flat Count',
            'job_count' => 'Job Count',
            'size_x' => 'Size X',
            'size_y' => 'Size Y',
            'has_hangar_bay' => 'Has Hangar Bay',
            'has_docking_bay' => 'Has Docking Bay',
            'can_recycle' => 'Can Recycle',
            'can_produce' => 'Can Produce',
            'is_asteroid_mining_depot' => 'Is Asteroid Mining Depot',
            'can_refine_alazhi' => 'Can Refine Alazhi',
            'can_interdict' => 'Can Interdict',
            'can_research' => 'Can Research',
            'can_mine' => 'Can Mine',
            'can_farm_alazhi' => 'Can Farm Alazhi',
            'can_load_materials' => 'Can Load Materials',
            'can_earn_income' => 'Can Earn Income',
            'base_hp' => 'Base HP',
            default => str($column)
                ->replace('_', ' ')
                ->title()
                ->toString(),
        };
    }
}
