<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->json('bundle_items')->nullable()->after('entity_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->dropColumn('bundle_items');
        });
    }
};
