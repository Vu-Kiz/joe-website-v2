<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('market_listings');
            $table->foreignId('buyer_user_id')->constrained('users');
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('total_credits'); // price * quantity at time of order
            $table->foreignId('payment_transfer_id')->nullable()->constrained('payment_transfers');
            $table->text('swc_transfer_result')->nullable();
            $table->string('status', 32)->default('pending_payment'); // pending_payment | paid | transfer_pending | completed | disputed | cancelled
            $table->text('dispute_note')->nullable();
            $table->timestamp('expires_at'); // 30 min from creation
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['listing_id', 'status']);
            $table->index(['buyer_user_id', 'status']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_orders');
    }
};
