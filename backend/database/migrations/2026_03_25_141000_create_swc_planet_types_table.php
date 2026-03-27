<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_planet_types', function (Blueprint $table): void {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable();
            $table->text('description')->nullable();
            $table->json('images')->nullable();
            $table->string('image_url')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('last_pulled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_planet_types');
    }
};
