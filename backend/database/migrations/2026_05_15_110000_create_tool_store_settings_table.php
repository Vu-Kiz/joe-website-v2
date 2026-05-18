<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_store_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payee_faction_id')->nullable()->constrained('factions')->nullOnDelete();
            $table->string('payee_swc_handle', 128)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_store_settings');
    }
};
