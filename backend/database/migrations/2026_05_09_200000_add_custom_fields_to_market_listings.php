<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->string('sale_type', 20)->default('standard')->after('channel');
            $table->string('custom_image_path', 512)->nullable()->after('entity_snapshot');
            $table->string('custom_image_watermarked_path', 512)->nullable()->after('custom_image_path');
            $table->string('custom_entity_category', 50)->nullable()->after('custom_image_watermarked_path');
            $table->string('custom_entity_uid', 100)->nullable()->after('custom_entity_category');
            $table->string('custom_entity_name', 255)->nullable()->after('custom_entity_uid');
            $table->string('custom_entity_image_url', 512)->nullable()->after('custom_entity_name');
            $table->boolean('is_unlimited')->default(false)->after('custom_entity_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->dropColumn([
                'sale_type',
                'custom_image_path',
                'custom_image_watermarked_path',
                'custom_entity_category',
                'custom_entity_uid',
                'custom_entity_name',
                'custom_entity_image_url',
                'is_unlimited',
            ]);
        });
    }
};
