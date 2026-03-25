<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_planets', function (Blueprint $table) {
            $table->unsignedBigInteger('population')->nullable()->after('size');
            $table->unsignedBigInteger('previous_population')->nullable()->after('population');
            $table->timestamp('previous_population_recorded_at')->nullable()->after('previous_population');
        });
    }

    public function down(): void
    {
        Schema::table('swc_planets', function (Blueprint $table) {
            $table->dropColumn([
                'population',
                'previous_population',
                'previous_population_recorded_at',
            ]);
        });
    }
};
