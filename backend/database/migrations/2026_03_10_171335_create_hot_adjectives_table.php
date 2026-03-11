<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hot_adjectives', function (Blueprint $table) {
            $table->id();
            $table->string('word', 100);
            $table->integer('min_temp');
            $table->integer('max_temp');

            $table->index('min_temp');
            $table->index('max_temp');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hot_adjectives');
    }
};