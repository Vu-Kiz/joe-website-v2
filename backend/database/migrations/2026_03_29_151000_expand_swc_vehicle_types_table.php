<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_vehicle_types', function (Blueprint $table) {
            if (!Schema::hasColumn('swc_vehicle_types', 'manoeuvrability')) {
                $table->integer('manoeuvrability')->nullable()->after('length');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'sensors')) {
                $table->integer('sensors')->nullable()->after('manoeuvrability');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'ecm')) {
                $table->integer('ecm')->nullable()->after('sensors');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'weight_tonnes')) {
                $table->decimal('weight_tonnes', 12, 2)->nullable()->after('ecm');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'volume_m3')) {
                $table->decimal('volume_m3', 12, 2)->nullable()->after('weight_tonnes');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'weight_capacity_tonnes')) {
                $table->decimal('weight_capacity_tonnes', 12, 2)->nullable()->after('volume_m3');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'volume_capacity_m3')) {
                $table->decimal('volume_capacity_m3', 12, 2)->nullable()->after('weight_capacity_tonnes');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'ionic_capacity')) {
                $table->integer('ionic_capacity')->nullable()->after('shield');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'has_repulsors')) {
                $table->boolean('has_repulsors')->nullable()->after('ionic_capacity');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'slot_size')) {
                $table->decimal('slot_size', 8, 2)->nullable()->after('has_repulsors');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'medical_rooms')) {
                $table->integer('medical_rooms')->nullable()->after('slot_size');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'has_hangar_bay')) {
                $table->boolean('has_hangar_bay')->nullable()->after('medical_rooms');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'has_docking_bay')) {
                $table->boolean('has_docking_bay')->nullable()->after('has_hangar_bay');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'can_recycle')) {
                $table->boolean('can_recycle')->nullable()->after('has_docking_bay');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'production_modifier')) {
                $table->integer('production_modifier')->nullable()->after('price_credits');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'recommended_workers')) {
                $table->integer('recommended_workers')->nullable()->after('production_modifier');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'recycling_xp')) {
                $table->integer('recycling_xp')->nullable()->after('recommended_workers');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'generic_slots')) {
                $table->integer('generic_slots')->nullable()->after('recycling_xp');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'terrain_restrictions')) {
                $table->json('terrain_restrictions')->nullable()->after('generic_slots');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'weapons')) {
                $table->json('weapons')->nullable()->after('terrain_restrictions');
            }
            if (!Schema::hasColumn('swc_vehicle_types', 'materials')) {
                $table->json('materials')->nullable()->after('weapons');
            }
        });
    }

    public function down(): void
    {
        Schema::table('swc_vehicle_types', function (Blueprint $table) {
            $columns = [
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'terrain_restrictions',
                'weapons',
                'materials',
            ];

            $existing = array_values(array_filter($columns, fn ($column) => Schema::hasColumn('swc_vehicle_types', $column)));
            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }
};
