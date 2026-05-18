<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('droidbrain_files', function (Blueprint $table) {
            $table->string('payment_status', 30)->default('pending')->index()->after('change_status');
        });

        // Mark all existing files that already have a reward log as complete,
        // and any with no reward log as pending so the payment worker catches them.
        DB::statement("
            UPDATE droidbrain_files f
            SET f.payment_status = CASE
                WHEN EXISTS (
                    SELECT 1 FROM droidbrain_reward_logs r WHERE r.file_id = f.id
                ) THEN 'complete'
                ELSE 'pending'
            END
        ");
    }

    public function down(): void
    {
        Schema::table('droidbrain_files', function (Blueprint $table) {
            $table->dropColumn('payment_status');
        });
    }
};
