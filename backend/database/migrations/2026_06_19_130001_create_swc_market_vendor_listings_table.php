<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_market_vendor_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained('swc_market_vendors')->cascadeOnDelete();

            $table->string('ware_name');
            $table->string('matched_item_type_uid', 64)->nullable();

            $table->unsignedBigInteger('quantity')->default(0);
            $table->unsignedBigInteger('price')->default(0);
            $table->string('currency', 20)->default('credits');

            $table->string('image_small')->nullable();
            $table->string('image_large')->nullable();

            $table->timestamps();

            $table->index('ware_name');
            $table->index('matched_item_type_uid');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_market_vendor_listings');
    }
};
