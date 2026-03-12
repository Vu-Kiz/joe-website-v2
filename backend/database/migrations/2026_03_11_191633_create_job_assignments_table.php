<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_assignments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('job_id')->constrained()->cascadeOnDelete();

            $table->foreignId('worker_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('worker_swc_uid', 32);
            $table->string('worker_handle', 100);

            $table->string('status', 20)->default('in_progress'); // in_progress | completed | cancelled
            $table->unsignedInteger('days_taken')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['job_id', 'worker_swc_uid']);
            $table->index(['job_id', 'status']);
            $table->index(['worker_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_assignments');
    }
};