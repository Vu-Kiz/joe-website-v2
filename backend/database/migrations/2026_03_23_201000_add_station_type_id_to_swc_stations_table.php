<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_stations', function (Blueprint $table) {
            $table->foreignId('station_type_id')
                ->nullable()
                ->after('type_name')
                ->constrained('swc_station_types')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('swc_stations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('station_type_id');
        });
    }
};
