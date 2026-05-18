<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Links individual users to a faction's tool subscription
        Schema::create('tool_subscription_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tool_subscription_id')->constrained('tool_subscriptions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['tool_subscription_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_subscription_members');
    }
};
