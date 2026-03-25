<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            // Primary app identity will be Discord-first.
            $table->string('discord_user_id', 40)->nullable()->unique();
            $table->string('discord_username', 100)->nullable();
            $table->string('discord_global_name', 100)->nullable();
            $table->string('discord_avatar_url', 255)->nullable();
            $table->timestamp('discord_linked_at')->nullable();

            // Current SWC snapshot for compatibility/read performance.
            // Historical links live in user_swc_accounts.
            $table->unsignedBigInteger('swc_character_id')->nullable()->unique();
            $table->string('swc_handle', 100)->nullable();
            $table->string('swc_avatar_url', 255)->nullable();

            // Permissions
            $table->boolean('is_joe_member')->default(false);
            $table->boolean('is_admin')->default(false);
            $table->boolean('is_sysadmin')->default(false);
            $table->boolean('is_intel')->default(false);
            $table->boolean('is_garry')->default(false);
            $table->boolean('is_raid')->default(false);

            $table->timestamps();
            $table->rememberToken();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
