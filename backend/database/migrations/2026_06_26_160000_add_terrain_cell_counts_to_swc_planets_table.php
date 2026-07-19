<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_planets', function (Blueprint $table) {
            // Cached counts so consumers (e.g. the Bounty Hunting candidate-worlds query)
            // never need to json_decode the (sometimes 100s of KB) terrain_grid column.
            // "Valid" = not Ocean/River/Volcanic terrain and not inside a city.
            $table->unsignedInteger('valid_terrain_cell_count')->nullable()->after('terrain_grid');
            $table->unsignedInteger('terrain_cell_count')->nullable()->after('valid_terrain_cell_count');
        });
    }

    public function down(): void
    {
        Schema::table('swc_planets', function (Blueprint $table) {
            $table->dropColumn(['valid_terrain_cell_count', 'terrain_cell_count']);
        });
    }
};
