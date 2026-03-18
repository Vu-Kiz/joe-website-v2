<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manual_payment_templates', function (Blueprint $table) {
            $table->id();

            $table->string('name', 150);

            $table->string('payer_subject_type', 20); // user | faction
            $table->unsignedBigInteger('payer_subject_id')->nullable();
            $table->string('payer_label', 150)->nullable();

            $table->string('payee_subject_type', 20)->default('user');
            $table->unsignedBigInteger('payee_subject_id')->nullable();
            $table->string('payee_swc_uid', 32)->nullable();
            $table->string('payee_handle', 100)->nullable();
            $table->string('payee_label', 150)->nullable();

            $table->unsignedBigInteger('amount')->default(0);
            $table->unsignedBigInteger('bonus_amount')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);

            $table->string('frequency', 20)->default('monthly'); // monthly
            $table->unsignedTinyInteger('day_of_month')->default(1);

            $table->date('start_date');
            $table->date('end_date')->nullable();

            $table->string('communication_prefix', 180)->nullable();
            $table->text('notes')->nullable();

            $table->string('status', 20)->default('active'); // active | paused
            $table->string('last_generated_period', 20)->nullable(); // YYYY-MM

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['payer_subject_type', 'payer_subject_id'], 'mpt_payer_idx');
            $table->index(['payee_subject_type', 'payee_subject_id'], 'mpt_payee_idx');
            $table->index(['status', 'frequency'], 'mpt_status_frequency_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_payment_templates');
    }
};