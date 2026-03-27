<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->timestamp('rescan_due_at')->nullable()->after('legacy_recorded_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_search_records', function (Blueprint $table) {
            $table->dropColumn('rescan_due_at');
        });
    }
};
