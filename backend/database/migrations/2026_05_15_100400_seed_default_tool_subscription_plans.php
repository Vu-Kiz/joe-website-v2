<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('tool_subscription_plans')->insert([
            [
                'key' => 'individual',
                'label' => 'Individual Subscription',
                'description' => 'Full access to all public Anarchy Industries tools for a single user.',
                'monthly_price_credits' => 0,
                'is_active' => false,
                'updated_by_user_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'faction',
                'label' => 'Faction Subscription',
                'description' => 'Full access to all public Anarchy Industries tools for an entire faction, including shared notes and scout data.',
                'monthly_price_credits' => 0,
                'is_active' => false,
                'updated_by_user_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('tool_subscription_plans')->whereIn('key', ['individual', 'faction'])->delete();
    }
};
