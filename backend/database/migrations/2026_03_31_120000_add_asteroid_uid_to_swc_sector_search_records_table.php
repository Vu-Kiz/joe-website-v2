<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->string('asteroid_uid')->nullable()->after('sector_uid');
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->dropColumn('asteroid_uid');
        });
    }
};
