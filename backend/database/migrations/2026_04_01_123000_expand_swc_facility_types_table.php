<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_facility_types', function (Blueprint $table) {
            $table->string('class_uid')->nullable()->after('name');
            $table->unsignedInteger('sensors')->nullable()->after('size');
            $table->decimal('weight_tonnes', 12, 2)->nullable()->after('sensors');
            $table->decimal('volume_m3', 12, 2)->nullable()->after('weight_tonnes');
            $table->decimal('volume_capacity_m3', 12, 2)->nullable()->after('volume_m3');
            $table->unsignedInteger('max_passengers')->nullable()->after('volume_capacity_m3');
            $table->unsignedInteger('flat_count')->nullable()->after('max_passengers');
            $table->unsignedInteger('job_count')->nullable()->after('flat_count');
            $table->unsignedInteger('size_x')->nullable()->after('job_count');
            $table->unsignedInteger('size_y')->nullable()->after('size_x');
            $table->unsignedInteger('hull')->nullable()->after('height');
            $table->unsignedInteger('shield')->nullable()->after('hull');
            $table->unsignedInteger('ionic_capacity')->nullable()->after('shield');
            $table->integer('energy')->nullable()->after('ionic_capacity');
            $table->boolean('can_load_materials')->nullable()->after('energy');
            $table->boolean('can_earn_income')->nullable()->after('can_load_materials');
            $table->unsignedInteger('medical_rooms')->nullable()->after('can_earn_income');
            $table->boolean('has_hangar_bay')->nullable()->after('medical_rooms');
            $table->boolean('has_docking_bay')->nullable()->after('has_hangar_bay');
            $table->boolean('can_recycle')->nullable()->after('has_docking_bay');
            $table->boolean('can_produce')->nullable()->after('can_recycle');
            $table->boolean('can_mine')->nullable()->after('can_produce');
            $table->boolean('can_refine_alazhi')->nullable()->after('can_mine');
            $table->boolean('can_farm_alazhi')->nullable()->after('can_refine_alazhi');
            $table->boolean('can_research')->nullable()->after('can_farm_alazhi');
            $table->unsignedInteger('production_modifier')->nullable()->after('price_credits');
            $table->unsignedInteger('recommended_workers')->nullable()->after('production_modifier');
            $table->unsignedInteger('recycling_xp')->nullable()->after('recommended_workers');
            $table->unsignedInteger('generic_slots')->nullable()->after('recycling_xp');
            $table->json('weapons')->nullable()->after('generic_slots');
            $table->json('materials')->nullable()->after('weapons');
        });
    }

    public function down(): void
    {
        Schema::table('swc_facility_types', function (Blueprint $table) {
            $table->dropColumn([
                'class_uid',
                'sensors',
                'weight_tonnes',
                'volume_m3',
                'volume_capacity_m3',
                'max_passengers',
                'flat_count',
                'job_count',
                'size_x',
                'size_y',
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
