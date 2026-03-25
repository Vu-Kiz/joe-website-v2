<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_terrain_types', function (Blueprint $table) {
            $table->unsignedInteger('material_probability_percent')->nullable()->after('code');
            $table->json('material_types')->nullable()->after('material_probability_percent');
            $table->json('images')->nullable()->after('material_types');
        });
    }

    public function down(): void
    {
        Schema::table('swc_terrain_types', function (Blueprint $table) {
            $table->dropColumn([
                'material_probability_percent',
                'material_types',
                'images',
            ]);
        });
    }
};
