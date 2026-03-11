<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_action_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->string('actor_handle', 255)->nullable();

            $table->string('area', 100);
            $table->string('action', 100);

            $table->string('target_type', 100)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();

            $table->string('summary', 500);
            $table->longText('before_json')->nullable();
            $table->longText('after_json')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index('actor_user_id');
            $table->index('area');
            $table->index('action');
            $table->index('target_type');
            $table->index('target_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_action_logs');
    }
};