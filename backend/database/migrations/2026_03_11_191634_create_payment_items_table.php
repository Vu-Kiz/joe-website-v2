<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_items', function (Blueprint $table) {
            $table->id();

            $table->string('tool_key', 50);
            $table->string('source_type', 50);
            $table->unsignedBigInteger('source_id');

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

            $table->string('status', 20)->default('pending'); // pending | attached | paid | cancelled
            $table->timestamp('paid_at')->nullable();

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['source_type', 'source_id']);
            $table->index(['tool_key', 'status'], 'pi_tool_status_idx');

            $table->index(
                ['payer_subject_type', 'payer_subject_id', 'status'],
                'pi_payer_status_idx'
            );

            $table->index(
                ['payee_subject_type', 'payee_subject_id', 'status'],
                'pi_payee_status_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_items');
    }
};