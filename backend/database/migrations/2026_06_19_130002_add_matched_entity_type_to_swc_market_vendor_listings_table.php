<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_market_vendor_listings', function (Blueprint $table) {
            $table->string('matched_entity_type', 20)->nullable()->after('matched_item_type_uid');
        });
    }

    public function down(): void
    {
        Schema::table('swc_market_vendor_listings', function (Blueprint $table) {
            $table->dropColumn('matched_entity_type');
        });
    }
};
