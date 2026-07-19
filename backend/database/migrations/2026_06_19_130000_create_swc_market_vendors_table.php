<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_market_vendors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('swc_vendor_id')->unique();
            $table->string('name');
            $table->text('description')->nullable();

            $table->string('owner_uid', 32)->nullable();
            $table->string('owner_label')->nullable();

            $table->string('shopkeeper_uid', 32)->nullable();
            $table->string('shopkeeper_name')->nullable();

            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_label')->nullable();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_label')->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();

            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->index(['galx', 'galy']);
            $table->index('owner_uid');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_market_vendors');
    }
};
