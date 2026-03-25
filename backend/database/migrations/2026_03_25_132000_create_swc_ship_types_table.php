<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_ship_types', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable();
            $table->string('class_name')->nullable();
            $table->decimal('length', 12, 2)->nullable();
            $table->integer('max_speed')->nullable();
            $table->decimal('hyperdrive', 8, 2)->nullable();
            $table->integer('max_passengers')->nullable();
            $table->integer('hull')->nullable();
            $table->integer('shield')->nullable();
            $table->unsignedBigInteger('price_credits')->nullable();
            $table->text('description')->nullable();
            $table->json('images')->nullable();
            $table->string('image_url')->nullable();
            $table->string('icon_url')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('last_pulled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_ship_types');
    }
};
