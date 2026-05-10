<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->boolean('image_watermarked')->default(false)->after('is_unlimited');
        });
    }

    public function down(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->dropColumn('image_watermarked');
        });
    }
};
