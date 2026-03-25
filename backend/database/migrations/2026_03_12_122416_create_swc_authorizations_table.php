<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_authorizations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_swc_account_id')
                ->nullable()
                ->constrained('user_swc_accounts')
                ->nullOnDelete();
            $table->unsignedBigInteger('swc_character_id')->nullable();

            $table->text('granted_scopes')->nullable();

            $table->boolean('has_personal_events_access')->default(false);
            $table->boolean('has_faction_events_access')->default(false);

            $table->text('access_token_encrypted')->nullable();
            $table->text('refresh_token_encrypted')->nullable();

            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->unique('user_id', 'swc_event_auth_user_unique');
            $table->index('user_swc_account_id', 'swc_event_auth_account_idx');
            $table->index('swc_character_id', 'swc_event_auth_character_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_authorizations');
    }
};
