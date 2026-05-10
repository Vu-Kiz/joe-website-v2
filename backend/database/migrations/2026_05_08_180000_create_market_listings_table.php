<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_listings', function (Blueprint $table) {
            $table->id();
            $table->string('channel', 32); // faction_store | member
            $table->string('seller_type', 16); // faction | user
            $table->unsignedBigInteger('seller_id');
            $table->string('entity_type', 32); // ship, vehicle, material, item, droid, etc.
            $table->string('entity_uid', 64); // SWC UID e.g. 1:12345
            $table->string('entity_name', 255);
            $table->string('entity_type_uid', 64)->nullable();
            $table->integer('location_galx')->nullable();
            $table->integer('location_galy')->nullable();
            $table->string('location_label', 255)->nullable();
            $table->unsignedBigInteger('price_credits'); // per unit for materials, total for entities
            $table->unsignedInteger('quantity_total')->default(1);
            $table->unsignedInteger('quantity_reserved')->default(0);
            $table->unsignedInteger('quantity_sold')->default(0);
            $table->text('notes')->nullable();
            $table->string('status', 32)->default('open'); // open | reserved | transfer_pending | completed | cancelled
            $table->foreignId('listed_by_user_id')->constrained('users');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['channel', 'status']);
            $table->index(['entity_type', 'status']);
            $table->index(['seller_type', 'seller_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_listings');
    }
};
