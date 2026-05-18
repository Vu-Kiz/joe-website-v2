<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_subscription_member_revocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tool_subscription_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('revoked_at');

            $table->foreign('tool_subscription_id', 'tsm_rev_sub_fk')->references('id')->on('tool_subscriptions')->cascadeOnDelete();
            $table->foreign('user_id', 'tsm_rev_user_fk')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['tool_subscription_id', 'user_id'], 'tsm_rev_sub_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_subscription_member_revocations');
    }
};
