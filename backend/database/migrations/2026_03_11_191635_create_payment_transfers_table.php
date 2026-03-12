<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transfers', function (Blueprint $table) {
            $table->id();

            $table->string('payer_subject_type', 20);
            $table->unsignedBigInteger('payer_subject_id')->nullable();
            $table->string('payer_label', 150)->nullable();

            $table->string('payee_subject_type', 20)->default('user');
            $table->unsignedBigInteger('payee_subject_id')->nullable();
            $table->string('payee_swc_uid', 32)->nullable();
            $table->string('payee_handle', 100)->nullable();
            $table->string('payee_label', 150)->nullable();

            $table->unsignedBigInteger('total_amount')->default(0);

            $table->string('reference', 80)->unique();
            $table->string('communication', 255)->nullable();

            $table->string('payment_method', 20)->default('single_link'); // single_link | bulk_copy
            $table->string('status', 20)->default('draft'); // draft | opened | verified | failed | cancelled

            $table->timestamp('opened_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('verified_event_id', 64)->nullable();
            $table->timestamp('paid_at')->nullable();

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(
                ['payer_subject_type', 'payer_subject_id', 'status'],
                'pt_payer_status_idx'
            );

            $table->index(
                ['payee_subject_type', 'payee_subject_id', 'status'],
                'pt_payee_status_idx'
            );
                    });
            }

    public function down(): void
    {
        Schema::dropIfExists('payment_transfers');
    }
};