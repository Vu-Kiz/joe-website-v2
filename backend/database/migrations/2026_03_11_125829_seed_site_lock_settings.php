<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            ['key' => 'site_lock_enabled', 'value' => '0'],
            ['key' => 'site_lock_message', 'value' => 'The site is temporarily unavailable. Please try again shortly.'],
            ['key' => 'site_lock_updated_at', 'value' => ''],
            ['key' => 'site_lock_updated_by', 'value' => ''],
        ];

        foreach ($rows as $row) {
            DB::table('app_settings')->updateOrInsert(
                ['key' => $row['key']],
                [
                    'value' => $row['value'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', [
            'site_lock_enabled',
            'site_lock_message',
            'site_lock_updated_at',
            'site_lock_updated_by',
        ])->delete();
    }
};