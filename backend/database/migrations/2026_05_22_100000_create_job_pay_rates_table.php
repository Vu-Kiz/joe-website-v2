<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_pay_rates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('unit_label', 100)->default('unit');
            $table->unsignedBigInteger('base_rate');
            $table->unsignedBigInteger('bonus_rate')->nullable();
            $table->string('bonus_description', 255)->nullable();
            $table->string('payer_subject_type', 20)->default('faction');
            $table->unsignedBigInteger('payer_subject_id')->nullable();
            $table->string('payer_label', 150)->nullable();
            $table->string('status', 20)->default('active');
            $table->unsignedBigInteger('created_by_user_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_pay_rates');
    }
};
