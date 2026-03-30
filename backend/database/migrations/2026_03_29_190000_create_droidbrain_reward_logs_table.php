<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('droidbrain_reward_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->foreignId('payment_item_id')->nullable()->constrained('payment_items')->nullOnDelete();
            $table->integer('galx');
            $table->integer('galy');
            $table->string('system_name', 255)->nullable();
            $table->unsignedBigInteger('snapshot_unixtime')->nullable();
            $table->string('reward_status', 30)->default('pending')->index();
            $table->boolean('is_new_system')->default(false);
            $table->unsignedInteger('new_entities_count')->default(0);
            $table->unsignedInteger('modified_entities_count')->default(0);
            $table->unsignedInteger('unchanged_entities_count')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->timestamp('rewarded_at')->nullable();
            $table->timestamp('cooldown_until')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['file_id', 'galx', 'galy'], 'droidbrain_reward_logs_file_coords_unique');
            $table->index(['galx', 'galy', 'rewarded_at'], 'droidbrain_reward_logs_coords_rewarded_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('droidbrain_reward_logs');
    }
};
