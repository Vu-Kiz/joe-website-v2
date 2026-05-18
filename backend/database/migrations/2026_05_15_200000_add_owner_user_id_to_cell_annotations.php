<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sector_cell_annotations', function (Blueprint $table) {
            $table->foreignId('owner_user_id')->nullable()->after('updated_by')->constrained('users')->nullOnDelete();
            $table->dropUnique(['sector_uid', 'galx', 'galy']);
        });
    }

    public function down(): void
    {
        Schema::table('swc_sector_cell_annotations', function (Blueprint $table) {
            $table->dropForeign(['owner_user_id']);
            $table->dropColumn('owner_user_id');
            $table->unique(['sector_uid', 'galx', 'galy']);
        });
    }
};
