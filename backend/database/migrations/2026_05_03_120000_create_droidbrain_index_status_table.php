<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('droidbrain_index_status', function (Blueprint $table) {
            $table->string('tab', 20)->primary();
            $table->boolean('is_dirty')->default(false);
            $table->timestamp('dirtied_at')->nullable();
            $table->timestamp('indexed_at')->nullable();
        });

        // Seed one row per tab
        $now = now();
        foreach (['ships', 'stations', 'planets', 'cities', 'vehicles', 'npcs'] as $tab) {
            \Illuminate\Support\Facades\DB::table('droidbrain_index_status')->insert([
                'tab'        => $tab,
                'is_dirty'   => true,
                'dirtied_at' => $now,
                'indexed_at' => null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('droidbrain_index_status');
    }
};
