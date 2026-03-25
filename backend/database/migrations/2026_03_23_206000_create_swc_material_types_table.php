<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_material_types', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable()->index();
            $table->text('description')->nullable();
            $table->decimal('weight_tonnes', 12, 2)->nullable();
            $table->decimal('volume_m3', 12, 2)->nullable();
            $table->unsignedInteger('rarity')->nullable();
            $table->unsignedBigInteger('price_credits')->nullable();
            $table->json('images')->nullable();
            $table->string('image_url')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_material_types');
    }
};
