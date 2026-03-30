<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_ship_types', function (Blueprint $table) {
            $table->integer('manoeuvrability')->nullable()->after('length');
            $table->integer('sensors')->nullable()->after('manoeuvrability');
            $table->integer('ecm')->nullable()->after('sensors');
            $table->float('weight_tonnes')->nullable()->after('ecm');
            $table->float('volume_m3')->nullable()->after('weight_tonnes');
            $table->float('weight_capacity_tonnes')->nullable()->after('volume_m3');
            $table->float('volume_capacity_m3')->nullable()->after('weight_capacity_tonnes');
            $table->integer('escape_pods')->nullable()->after('max_passengers');
            $table->integer('armour')->nullable()->after('shield');
            $table->integer('ionic_capacity')->nullable()->after('armour');
            $table->boolean('has_repulsors')->nullable()->after('ionic_capacity');
            $table->float('slot_size')->nullable()->after('has_repulsors');
            $table->integer('medical_rooms')->nullable()->after('slot_size');
            $table->boolean('has_hangar_bay')->nullable()->after('medical_rooms');
            $table->boolean('has_docking_bay')->nullable()->after('has_hangar_bay');
            $table->boolean('can_recycle')->nullable()->after('has_docking_bay');
            $table->boolean('can_interdict')->nullable()->after('can_recycle');
            $table->integer('production_modifier')->nullable()->after('price_credits');
            $table->integer('recommended_workers')->nullable()->after('production_modifier');
            $table->integer('recycling_xp')->nullable()->after('recommended_workers');
            $table->integer('generic_slots')->nullable()->after('recycling_xp');
            $table->json('weapons')->nullable()->after('generic_slots');
            $table->json('materials')->nullable()->after('weapons');
        });
    }

    public function down(): void
    {
        Schema::table('swc_ship_types', function (Blueprint $table) {
            $table->dropColumn([
                'manoeuvrability',
                'sensors',
                'ecm',
                'weight_tonnes',
                'volume_m3',
                'weight_capacity_tonnes',
                'volume_capacity_m3',
                'escape_pods',
                'armour',
                'ionic_capacity',
                'has_repulsors',
                'slot_size',
                'medical_rooms',
                'has_hangar_bay',
                'has_docking_bay',
                'can_recycle',
                'can_interdict',
                'production_modifier',
                'recommended_workers',
                'recycling_xp',
                'generic_slots',
                'weapons',
                'materials',
            ]);
        });
    }
};
