<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tatooine_daily_weather', function (Blueprint $table) {
            $table->id();
            $table->date('weather_date')->unique();
            $table->integer('temperature');
            $table->string('adjective', 100);
            $table->text('advice');
            $table->text('message');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tatooine_daily_weather');
    }
};