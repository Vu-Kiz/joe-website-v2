<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_sectors', function (Blueprint $table) {
            $table->string('owner_uid')->nullable()->index()->after('name');
            $table->string('owner_name')->nullable()->after('owner_uid');
            $table->unsignedBigInteger('population')->nullable()->after('owner_name');
            $table->unsignedInteger('known_systems')->nullable()->after('population');
        });
    }

    public function down(): void
    {
        Schema::table('swc_sectors', function (Blueprint $table) {
            $table->dropColumn([
                'owner_uid',
                'owner_name',
                'population',
                'known_systems',
            ]);
        });
    }
};
