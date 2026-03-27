<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_access_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->string('actor_handle', 255)->nullable();
            $table->string('area', 100);
            $table->string('action', 100);
            $table->string('request_method', 16);
            $table->string('request_path', 500);
            $table->string('summary', 500);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('actor_user_id');
            $table->index('area');
            $table->index('action');
            $table->index('request_method');
            $table->index('response_status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_access_logs');
    }
};
