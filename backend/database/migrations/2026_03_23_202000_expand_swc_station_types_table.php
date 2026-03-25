<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_station_types', function (Blueprint $table) {
            $table->unsignedInteger('sensors')->nullable()->after('description');
            $table->unsignedInteger('ecm')->nullable()->after('sensors');
            $table->decimal('weight_tonnes', 14, 2)->nullable()->after('ecm');
            $table->decimal('volume_m3', 14, 2)->nullable()->after('weight_tonnes');
            $table->decimal('weight_capacity_tonnes', 14, 2)->nullable()->after('volume_m3');
            $table->decimal('volume_capacity_m3', 14, 2)->nullable()->after('weight_capacity_tonnes');
            $table->unsignedInteger('max_passengers')->nullable()->after('volume_capacity_m3');
            $table->unsignedInteger('escape_pods')->nullable()->after('max_passengers');
            $table->unsignedInteger('hull')->nullable()->after('height');
            $table->unsignedInteger('shield')->nullable()->after('hull');
            $table->unsignedInteger('ionic_capacity')->nullable()->after('shield');
            $table->unsignedInteger('medical_rooms')->nullable()->after('ionic_capacity');
            $table->boolean('has_hangar_bay')->nullable()->after('medical_rooms');
            $table->boolean('has_docking_bay')->nullable()->after('has_hangar_bay');
            $table->boolean('can_recycle')->nullable()->after('has_docking_bay');
            $table->boolean('can_produce')->nullable()->after('can_recycle');
            $table->boolean('is_asteroid_mining_depot')->nullable()->after('can_produce');
            $table->boolean('can_refine_alazhi')->nullable()->after('is_asteroid_mining_depot');
            $table->boolean('can_interdict')->nullable()->after('can_refine_alazhi');
            $table->boolean('can_research')->nullable()->after('can_interdict');
            $table->unsignedBigInteger('price_credits')->nullable()->after('can_research');
            $table->unsignedInteger('production_modifier')->nullable()->after('price_credits');
            $table->unsignedInteger('recommended_workers')->nullable()->after('production_modifier');
            $table->unsignedInteger('recycling_xp')->nullable()->after('recommended_workers');
            $table->unsignedInteger('generic_slots')->nullable()->after('recycling_xp');
            $table->json('weapons')->nullable()->after('generic_slots');
            $table->json('materials')->nullable()->after('weapons');
            $table->json('images')->nullable()->after('materials');
        });
    }

    public function down(): void
    {
        Schema::table('swc_station_types', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });
    }
};
