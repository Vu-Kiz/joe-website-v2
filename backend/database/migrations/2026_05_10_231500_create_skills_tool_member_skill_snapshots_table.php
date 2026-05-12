<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('skills_tool_member_skill_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('swc_character_id');
            $table->string('swc_uid', 32);
            $table->string('swc_handle')->nullable();
            $table->json('skills_payload')->nullable();
            $table->unsignedSmallInteger('upstream_status')->nullable();
            $table->string('auth_mode', 20)->nullable();
            $table->timestamp('fetched_at')->nullable();
            $table->timestamp('last_attempted_at')->nullable();
            $table->string('error_message', 255)->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('swc_character_id');
            $table->index('swc_uid');
            $table->index('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('skills_tool_member_skill_snapshots');
    }
};
