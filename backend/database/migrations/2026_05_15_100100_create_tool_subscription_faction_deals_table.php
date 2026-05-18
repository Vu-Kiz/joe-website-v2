<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_subscription_faction_deals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained('factions')->cascadeOnDelete();
            $table->string('plan_key', 32);
            $table->unsignedBigInteger('override_price_credits');
            $table->text('notes')->nullable();
            $table->foreignId('set_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['faction_id', 'plan_key']);
            $table->index('plan_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_subscription_faction_deals');
    }
};
