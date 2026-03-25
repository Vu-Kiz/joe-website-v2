<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_swc_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('swc_character_id')->unique();
            $table->string('swc_handle', 100)->nullable();
            $table->string('swc_avatar_url', 255)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamp('linked_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('unlinked_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_primary'], 'user_swc_accounts_user_primary_idx');
            $table->index(['user_id', 'unlinked_at'], 'user_swc_accounts_user_unlinked_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_swc_accounts');
    }
};
