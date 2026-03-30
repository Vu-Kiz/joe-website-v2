<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (!Schema::hasColumn('users', 'discord_user_id')) {
                $table->string('discord_user_id', 40)->nullable()->unique();
            }

            if (!Schema::hasColumn('users', 'discord_username')) {
                $table->string('discord_username', 100)->nullable();
            }

            if (!Schema::hasColumn('users', 'discord_global_name')) {
                $table->string('discord_global_name', 100)->nullable();
            }

            if (!Schema::hasColumn('users', 'discord_avatar_url')) {
                $table->string('discord_avatar_url', 255)->nullable();
            }

            if (!Schema::hasColumn('users', 'discord_linked_at')) {
                $table->timestamp('discord_linked_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'discord_linked_at')) {
                $table->dropColumn('discord_linked_at');
            }

            if (Schema::hasColumn('users', 'discord_avatar_url')) {
                $table->dropColumn('discord_avatar_url');
            }

            if (Schema::hasColumn('users', 'discord_global_name')) {
                $table->dropColumn('discord_global_name');
            }

            if (Schema::hasColumn('users', 'discord_username')) {
                $table->dropColumn('discord_username');
            }

            if (Schema::hasColumn('users', 'discord_user_id')) {
                $table->dropUnique('users_discord_user_id_unique');
                $table->dropColumn('discord_user_id');
            }
        });
    }
};
