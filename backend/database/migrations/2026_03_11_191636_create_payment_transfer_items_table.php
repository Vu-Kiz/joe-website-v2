<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_item_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(
                ['payment_transfer_id', 'payment_item_id'],
                'pti_transfer_item_uniq'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transfer_items');
    }
};