<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_creature_types', function (Blueprint $table) {
            $table->float('slot_size')->nullable()->after('description');
            $table->string('species')->nullable()->index()->after('slot_size');
            $table->unsignedInteger('base_hp')->nullable()->after('species');
            $table->float('weight_tonnes')->nullable()->after('base_hp');
            $table->float('volume_m3')->nullable()->after('weight_tonnes');
            $table->string('homeworld_uid')->nullable()->index()->after('volume_m3');
            $table->string('homeworld_name')->nullable()->index()->after('homeworld_uid');
            $table->text('homeworld_href')->nullable()->after('homeworld_name');
            $table->json('spawn_terrain_types')->nullable()->after('homeworld_href');
            $table->json('terrain_restrictions')->nullable()->after('spawn_terrain_types');
            $table->json('skills')->nullable()->after('terrain_restrictions');
        });
    }

    public function down(): void
    {
        Schema::table('swc_creature_types', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });
    }
};
