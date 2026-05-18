<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('droidbrain_reward_logs', function (Blueprint $table) {
            $table->unsignedInteger('modified_too_recent_count')->default(0)->after('unchanged_entities_count');
        });

        // Backfill from existing meta JSON where available.
        DB::statement("
            UPDATE droidbrain_reward_logs
            SET modified_too_recent_count = COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(meta, '$.modified_too_recent_count')),
                0
            )
            WHERE meta IS NOT NULL
        ");
    }

    public function down(): void
    {
        Schema::table('droidbrain_reward_logs', function (Blueprint $table) {
            $table->dropColumn('modified_too_recent_count');
        });
    }
};
