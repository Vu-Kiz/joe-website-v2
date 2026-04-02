<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discord_message_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('notification_key', 50);
            $table->string('source_type', 50);
            $table->unsignedBigInteger('source_id');
            $table->string('guild_id', 40)->nullable();
            $table->string('channel_id', 40);
            $table->json('message_ids');
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamps();

            $table->unique(['notification_key', 'source_type', 'source_id'], 'discord_delivery_source_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_message_deliveries');
    }
};
