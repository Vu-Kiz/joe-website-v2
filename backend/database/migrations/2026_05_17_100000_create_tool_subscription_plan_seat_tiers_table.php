<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_subscription_plan_seat_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('plan_key');
            $table->unsignedInteger('min_seats');
            $table->unsignedInteger('price_per_seat_credits');
            $table->timestamps();

            $table->unique(['plan_key', 'min_seats']);
            $table->index('plan_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_subscription_plan_seat_tiers');
    }
};
