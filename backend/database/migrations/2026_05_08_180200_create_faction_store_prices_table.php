<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faction_store_prices', function (Blueprint $table) {
            $table->id();
            $table->string('entity_uid', 64)->unique();
            $table->string('entity_type', 32);
            $table->string('label', 255);
            $table->unsignedBigInteger('price_per_unit');
            $table->foreignId('set_by_user_id')->constrained('users');
            $table->timestamps();

            $table->index('entity_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faction_store_prices');
    }
};
