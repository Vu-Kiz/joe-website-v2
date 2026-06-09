<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_weapon_types', function (Blueprint $table) {
            $table->unsignedInteger('fire_delay')->nullable()->after('tracking');
        });
    }

    public function down(): void
    {
        Schema::table('swc_weapon_types', function (Blueprint $table) {
            $table->dropColumn('fire_delay');
        });
    }
};
