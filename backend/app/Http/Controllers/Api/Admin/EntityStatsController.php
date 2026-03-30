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

class EntityStatsController extends Controller
{
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

        $before = collect($config['editable'])
            ->mapWithKeys(fn (string $field) => [$field => $record->{$field}])
            ->toArray();

        $record->fill($input);
        $record->save();

        $afterRecord = $record->fresh($config['select']);

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
                    'class_name',
                    'size',
                    'length',
                    'width',
                    'height',
                    'description',
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
                    'size',
                    'length',
                    'width',
                    'height',
                    'description',
                    'price_credits',
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
}
