<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_member_import_logs', function (Blueprint $table) {
            $table->json('reward_breakdown')->nullable()->after('areas');
        });
    }

    public function down(): void
    {
        Schema::table('swc_member_import_logs', function (Blueprint $table) {
            $table->dropColumn('reward_breakdown');
        });
    }
};
