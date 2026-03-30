<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_vehicle_types', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable()->index();
            $table->string('class_name')->nullable()->index();
            $table->longText('description')->nullable();
            $table->decimal('length', 10, 2)->nullable();
            $table->integer('max_speed')->nullable();
            $table->integer('max_passengers')->nullable();
            $table->integer('hull')->nullable();
            $table->integer('shield')->nullable();
            $table->unsignedBigInteger('price_credits')->nullable();
            $table->json('images')->nullable();
            $table->text('image_url')->nullable();
            $table->text('icon_url')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_vehicle_types');
    }
};
