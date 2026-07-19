<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_market_vendors', function (Blueprint $table) {
            $table->string('planet_uid', 32)->nullable()->after('container_label');
            $table->string('planet_label')->nullable()->after('planet_uid');
            $table->string('city_uid', 32)->nullable()->after('planet_label');
            $table->string('city_label')->nullable()->after('city_uid');

            // In-system grid position (0-19 style), plus on-planet surface tile and
            // ground tile — the finer-grained "where in system / where on the ground"
            // location a member needs once they've already reached the right galaxy grid.
            $table->integer('system_x')->nullable()->after('galy');
            $table->integer('system_y')->nullable()->after('system_x');
            $table->integer('surface_x')->nullable()->after('system_y');
            $table->integer('surface_y')->nullable()->after('surface_x');
            $table->integer('ground_x')->nullable()->after('surface_y');
            $table->integer('ground_y')->nullable()->after('ground_x');
        });
    }

    public function down(): void
    {
        Schema::table('swc_market_vendors', function (Blueprint $table) {
            $table->dropColumn([
                'planet_uid', 'planet_label', 'city_uid', 'city_label',
                'system_x', 'system_y', 'surface_x', 'surface_y', 'ground_x', 'ground_y',
            ]);
        });
    }
};
