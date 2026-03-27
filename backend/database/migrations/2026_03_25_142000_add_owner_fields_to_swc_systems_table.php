<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_systems', function (Blueprint $table) {
            $table->string('owner_uid')->nullable()->index()->after('sector_name');
            $table->string('owner_name')->nullable()->after('owner_uid');
        });
    }

    public function down(): void
    {
        Schema::table('swc_systems', function (Blueprint $table) {
            $table->dropColumn(['owner_uid', 'owner_name']);
        });
    }
};
