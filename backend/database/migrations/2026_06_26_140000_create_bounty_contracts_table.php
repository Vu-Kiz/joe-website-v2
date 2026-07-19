<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bounty_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('target_name');
            $table->unsignedTinyInteger('difficulty');
            $table->enum('contract_type', ['kill', 'rescue'])->default('kill');
            $table->enum('status', ['active', 'completed', 'failed'])->default('active');
            $table->dateTime('deadline_at')->nullable();
            $table->text('notes')->nullable();
            $table->integer('estimated_galx')->nullable();
            $table->integer('estimated_galy')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'deadline_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bounty_contracts');
    }
};
