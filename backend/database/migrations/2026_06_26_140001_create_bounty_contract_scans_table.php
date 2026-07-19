<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bounty_contract_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bounty_contract_id')->constrained('bounty_contracts')->cascadeOnDelete();
            $table->integer('scan_galx');
            $table->integer('scan_galy');
            $table->decimal('bearing_degrees', 5, 1);
            $table->enum('range_band', ['bearing_only', 'inner', 'mid', 'outer', 'beyond_100'])->nullable();
            $table->timestamps();

            $table->index(['bounty_contract_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bounty_contract_scans');
    }
};
