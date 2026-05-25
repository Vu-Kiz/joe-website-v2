<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('admin_nav_preferences', 'favorites')) {
            return;
        }

        Schema::table('admin_nav_preferences', function (Blueprint $table) {
            $table->json('favorites')->nullable()->after('recents');
        });
    }

    public function down(): void
    {
        Schema::table('admin_nav_preferences', function (Blueprint $table) {
            $table->dropColumn('favorites');
        });
    }
};
