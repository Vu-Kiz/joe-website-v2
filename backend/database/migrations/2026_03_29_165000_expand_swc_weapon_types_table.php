<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_weapon_types', function (Blueprint $table) {
            $table->string('damage_type')->nullable()->after('description');
            $table->unsignedInteger('min_damage')->nullable()->after('damage_type');
            $table->unsignedInteger('max_damage')->nullable()->after('min_damage');
            $table->unsignedInteger('optimum_range')->nullable()->after('max_damage');
            $table->unsignedInteger('max_hits')->nullable()->after('optimum_range');
            $table->decimal('drop_off', 8, 2)->nullable()->after('max_hits');
            $table->unsignedInteger('firepower')->nullable()->after('drop_off');
            $table->unsignedInteger('tracking')->nullable()->after('firepower');
            $table->boolean('is_poison')->nullable()->after('tracking');
            $table->boolean('is_dual')->nullable()->after('is_poison');
        });
    }

    public function down(): void
    {
        Schema::table('swc_weapon_types', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });
    }
};
