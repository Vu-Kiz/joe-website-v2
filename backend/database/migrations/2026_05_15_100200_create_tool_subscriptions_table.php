<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('subscriber_type', 16); // 'user' or 'faction'
            $table->unsignedBigInteger('subscriber_id');
            $table->string('plan_key', 32);
            $table->string('status', 16)->default('active'); // active, cancelled, expired
            $table->unsignedBigInteger('price_paid_credits');
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->foreignId('activated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['subscriber_type', 'subscriber_id']);
            $table->index('plan_key');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_subscriptions');
    }
};
