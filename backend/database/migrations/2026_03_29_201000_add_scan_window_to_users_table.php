<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('scan_window_top_left_galx')->nullable()->after('can_view_asteroid_intel');
            $table->integer('scan_window_top_left_galy')->nullable()->after('scan_window_top_left_galx');
            $table->integer('scan_window_bottom_right_galx')->nullable()->after('scan_window_top_left_galy');
            $table->integer('scan_window_bottom_right_galy')->nullable()->after('scan_window_bottom_right_galx');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'scan_window_top_left_galx',
                'scan_window_top_left_galy',
                'scan_window_bottom_right_galx',
                'scan_window_bottom_right_galy',
            ]);
        });
    }
};
