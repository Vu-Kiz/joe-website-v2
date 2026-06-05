<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_item_types', function (Blueprint $table) {
            $table->unsignedInteger('batch_quantity')->nullable()->after('price_credits');
            $table->unsignedInteger('production_modifier')->nullable()->after('batch_quantity');
            $table->unsignedInteger('recommended_workers')->nullable()->after('production_modifier');
            $table->json('materials')->nullable()->after('recommended_workers');
        });
    }

    public function down(): void
    {
        Schema::table('swc_item_types', function (Blueprint $table) {
            $table->dropColumn(['batch_quantity', 'production_modifier', 'recommended_workers', 'materials']);
        });
    }
};
