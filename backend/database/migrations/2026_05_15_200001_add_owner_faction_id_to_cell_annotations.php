<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_cell_annotations', function (Blueprint $table) {
            $table->unsignedBigInteger('owner_faction_id')->nullable()->after('owner_user_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_cell_annotations', function (Blueprint $table) {
            $table->dropColumn('owner_faction_id');
        });
    }
};
