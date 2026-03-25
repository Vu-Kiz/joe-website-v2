<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_station_types', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable()->index();
            $table->string('category')->nullable()->index();
            $table->string('class_name')->nullable();
            $table->unsignedInteger('size')->nullable();
            $table->decimal('length', 10, 2)->nullable();
            $table->decimal('width', 10, 2)->nullable();
            $table->decimal('height', 10, 2)->nullable();
            $table->longText('description')->nullable();
            $table->text('image_url')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_station_types');
    }
};
