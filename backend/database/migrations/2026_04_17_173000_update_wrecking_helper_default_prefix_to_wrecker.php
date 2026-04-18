<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE wrecking_helper_settings ALTER COLUMN prefix SET DEFAULT 'wrecker'");

        DB::table('wrecking_helper_settings')
            ->where('prefix', 'Tilbawrecker')
            ->update(['prefix' => 'wrecker']);
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE wrecking_helper_settings ALTER COLUMN prefix SET DEFAULT 'Tilbawrecker'");

        DB::table('wrecking_helper_settings')
            ->where('prefix', 'wrecker')
            ->update(['prefix' => 'Tilbawrecker']);
    }
};
