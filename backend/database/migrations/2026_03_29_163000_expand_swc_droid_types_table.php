<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_droid_types', function (Blueprint $table) {
            $table->unsignedInteger('sensors')->nullable()->after('description');
            $table->unsignedInteger('ecm')->nullable()->after('sensors');
            $table->unsignedInteger('batch_quantity')->nullable()->after('ecm');
            $table->decimal('weight_tonnes', 12, 3)->nullable()->after('batch_quantity');
            $table->decimal('volume_m3', 12, 3)->nullable()->after('weight_tonnes');
            $table->decimal('weight_capacity_tonnes', 12, 3)->nullable()->after('volume_m3');
            $table->decimal('volume_capacity_m3', 12, 3)->nullable()->after('weight_capacity_tonnes');
            $table->unsignedInteger('hull')->nullable()->after('volume_capacity_m3');
            $table->unsignedInteger('shield')->nullable()->after('hull');
            $table->unsignedInteger('ionic_capacity')->nullable()->after('shield');
            $table->unsignedInteger('armour')->nullable()->after('ionic_capacity');
            $table->decimal('slot_size', 8, 2)->nullable()->after('armour');
            $table->json('terrain_restrictions')->nullable()->after('slot_size');
            $table->unsignedInteger('production_modifier')->nullable()->after('price_credits');
            $table->unsignedInteger('recommended_workers')->nullable()->after('production_modifier');
            $table->unsignedInteger('recycling_xp')->nullable()->after('recommended_workers');
            $table->unsignedInteger('generic_slots')->nullable()->after('recycling_xp');
            $table->json('weapons')->nullable()->after('skills');
            $table->json('materials')->nullable()->after('weapons');
        });
    }

    public function down(): void
    {
        Schema::table('swc_droid_types', function (Blueprint $table) {
            $table->dropColumn([
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
