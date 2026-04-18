<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_ship_types', function (Blueprint $table) {
            $table->json('shield_arcs')->nullable()->after('shield');
        });
    }

    public function down(): void
    {
        Schema::table('swc_ship_types', function (Blueprint $table) {
            $table->dropColumn('shield_arcs');
        });
    }
};
