<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->dropUnique('swc_sector_search_records_sector_uid_galx_galy_unique');
        });

        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->string('sector_uid')->nullable()->change();
            $table->unique(['galx', 'galy'], 'swc_sector_search_records_galx_galy_unique');
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->dropUnique('swc_sector_search_records_galx_galy_unique');
        });

        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->string('sector_uid')->nullable(false)->change();
            $table->unique(['sector_uid', 'galx', 'galy'], 'swc_sector_search_records_sector_uid_galx_galy_unique');
        });
    }
};
