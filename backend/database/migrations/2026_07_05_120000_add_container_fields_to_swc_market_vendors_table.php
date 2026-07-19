<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_market_vendors', function (Blueprint $table) {
            $table->string('container_uid', 32)->nullable()->after('system_label');
            $table->string('container_type', 32)->nullable()->after('container_uid');
            $table->string('container_label')->nullable()->after('container_type');

            $table->index('container_label');
        });
    }

    public function down(): void
    {
        Schema::table('swc_market_vendors', function (Blueprint $table) {
            $table->dropIndex(['container_label']);
            $table->dropColumn(['container_uid', 'container_type', 'container_label']);
        });
    }
};
