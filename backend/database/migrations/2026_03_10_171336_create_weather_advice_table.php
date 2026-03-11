<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_advice', function (Blueprint $table) {
            $table->id();
            $table->text('advice');
            $table->unsignedInteger('weight')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_advice');
    }
};