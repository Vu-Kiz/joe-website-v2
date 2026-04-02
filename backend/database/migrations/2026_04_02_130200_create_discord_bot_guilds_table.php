<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discord_bot_guilds', function (Blueprint $table) {
            $table->id();
            $table->string('guild_id', 40)->unique();
            $table->string('guild_name', 150);
            $table->string('icon_url', 255)->nullable();
            $table->unsignedInteger('member_count')->nullable();
            $table->boolean('available')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_bot_guilds');
    }
};
