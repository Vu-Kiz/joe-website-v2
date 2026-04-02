<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discord_outbox_messages', function (Blueprint $table) {
            $table->id();
            $table->string('notification_key', 50);
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->text('content');
            $table->json('meta')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['notification_key', 'status'], 'discord_outbox_key_status_idx');
            $table->index(['status', 'claimed_at'], 'discord_outbox_claim_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_outbox_messages');
    }
};
