<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'can_access_fleet_commander')) {
                $table->boolean('can_access_fleet_commander')
                    ->default(false)
                    ->after('can_access_wrecking_helper_extension');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'can_access_fleet_commander')) {
                $table->dropColumn('can_access_fleet_commander');
            }
        });
    }
};
