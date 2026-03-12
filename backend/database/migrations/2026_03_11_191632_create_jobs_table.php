<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();

            $table->string('title');
            $table->text('description')->nullable();

            $table->string('status', 20)->default('open'); // open | assigned | completed | closed | cancelled
            $table->string('job_mode', 20)->default('single'); // single | multi | open_ended
            $table->string('pay_type', 30)->default('fixed'); // fixed | per_day_hyper

            $table->unsignedBigInteger('reward_amount')->default(0);
            $table->unsignedBigInteger('bonus_amount')->default(0);
            $table->string('bonus_reward')->nullable();
            $table->string('bonus_note')->nullable();

            $table->string('payer_subject_type', 20)->default('user'); // user | faction
            $table->unsignedBigInteger('payer_subject_id')->nullable();
            $table->string('payer_label', 150)->nullable();

            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('created_by_swc_uid', 32);
            $table->string('created_by_handle', 100);

            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assigned_to_swc_uid', 32)->nullable();
            $table->string('assigned_to_handle', 100)->nullable();

            $table->unsignedInteger('days_taken')->nullable();

            $table->timestamp('completed_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['status']);
            $table->index(['job_mode']);
            $table->index(['created_by_user_id']);
            $table->index(['assigned_to_user_id']);
            $table->index(['payer_subject_type', 'payer_subject_id'], 'jobs_payer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jobs');
    }
};