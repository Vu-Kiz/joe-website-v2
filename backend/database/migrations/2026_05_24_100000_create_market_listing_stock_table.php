<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_listing_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('market_listings')->cascadeOnDelete();
            $table->string('entity_uid', 64);
            $table->string('entity_type', 32);
            $table->string('status', 16)->default('available'); // available | reserved | sold
            $table->foreignId('order_id')->nullable()->constrained('market_orders')->nullOnDelete();
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();

            $table->index(['listing_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_listing_stock');
    }
};
