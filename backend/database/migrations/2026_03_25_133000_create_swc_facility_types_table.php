<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_facility_types', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable();
            $table->string('class_name')->nullable();
            $table->string('size')->nullable();
            $table->decimal('length', 12, 2)->nullable();
            $table->decimal('width', 12, 2)->nullable();
            $table->decimal('height', 12, 2)->nullable();
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
        Schema::dropIfExists('swc_facility_types');
    }
};
