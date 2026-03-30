<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hyper_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('from_system_identifier');
            $table->string('from_system_name')->nullable();
            $table->string('to_system_identifier');
            $table->string('to_system_name')->nullable();
            $table->string('ship_uid')->nullable();
            $table->string('ship_name')->nullable();
            $table->string('ship_class_name')->nullable();
            $table->unsignedTinyInteger('hyperspeed')->default(1);
            $table->unsignedTinyInteger('piloting_skill')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hyper_plans');
    }
};
