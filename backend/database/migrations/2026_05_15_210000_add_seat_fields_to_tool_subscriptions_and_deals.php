<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tool_subscriptions', function (Blueprint $table) {
            $table->unsignedInteger('seat_count')->nullable()->after('price_paid_credits');
        });

        Schema::table('tool_subscription_faction_deals', function (Blueprint $table) {
            $table->unsignedInteger('per_seat_price_credits')->nullable()->after('override_price_credits');
            $table->unsignedInteger('max_seats')->nullable()->after('per_seat_price_credits');
        });
    }

    public function down(): void
    {
        Schema::table('tool_subscriptions', function (Blueprint $table) {
            $table->dropColumn('seat_count');
        });

        Schema::table('tool_subscription_faction_deals', function (Blueprint $table) {
            $table->dropColumn(['per_seat_price_credits', 'max_seats']);
        });
    }
};
