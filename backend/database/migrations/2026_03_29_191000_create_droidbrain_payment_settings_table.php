<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('droidbrain_payment_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('default_payer_faction_id')->nullable()->constrained('factions')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('droidbrain_payment_settings');
    }
};
