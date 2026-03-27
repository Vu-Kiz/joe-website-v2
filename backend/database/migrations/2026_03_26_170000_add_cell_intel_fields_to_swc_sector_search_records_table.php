<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->boolean('planetoids_checked')->nullable()->after('has_asteroids');
            $table->string('planetoid_1_type')->nullable()->after('planetoids_checked');
            $table->string('planetoid_1_size', 10)->nullable()->after('planetoid_1_type');
            $table->string('planetoid_2_type')->nullable()->after('planetoid_1_size');
            $table->string('planetoid_2_size', 10)->nullable()->after('planetoid_2_type');
            $table->boolean('has_ships')->nullable()->after('planetoid_2_size');
            $table->boolean('has_stations')->nullable()->after('has_ships');
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->dropColumn([
                'planetoids_checked',
                'planetoid_1_type',
                'planetoid_1_size',
                'planetoid_2_type',
                'planetoid_2_size',
                'has_ships',
                'has_stations',
            ]);
        });
    }
};
