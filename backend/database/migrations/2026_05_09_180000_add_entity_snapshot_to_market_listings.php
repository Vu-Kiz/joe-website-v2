<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->string('entity_image_url', 512)->nullable()->after('entity_type_uid');
            $table->json('entity_snapshot')->nullable()->after('entity_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->dropColumn(['entity_image_url', 'entity_snapshot']);
        });
    }
};
