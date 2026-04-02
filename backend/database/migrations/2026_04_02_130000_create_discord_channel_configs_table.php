<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discord_channel_configs', function (Blueprint $table) {
            $table->id();
            $table->string('notification_key', 50)->unique();
            $table->string('guild_id', 40)->nullable();
            $table->string('channel_id', 40);
            $table->string('channel_name', 120)->nullable();
            $table->foreignId('set_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('set_by_discord_user_id', 40)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_channel_configs');
    }
};
