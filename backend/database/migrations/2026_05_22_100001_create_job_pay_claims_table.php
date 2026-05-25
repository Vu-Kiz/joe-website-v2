<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_pay_claims', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('job_pay_rate_id');
            $table->unsignedBigInteger('claimant_user_id');
            $table->string('claimant_swc_uid', 50)->nullable();
            $table->string('claimant_handle', 100)->nullable();
            $table->unsignedInteger('quantity');
            $table->boolean('include_bonus')->default(false);
            $table->unsignedBigInteger('base_total');
            $table->unsignedBigInteger('bonus_total')->default(0);
            $table->unsignedBigInteger('total_amount');
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedBigInteger('reviewed_by_user_id')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->unsignedBigInteger('payment_item_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->foreign('job_pay_rate_id')->references('id')->on('job_pay_rates')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_pay_claims');
    }
};
