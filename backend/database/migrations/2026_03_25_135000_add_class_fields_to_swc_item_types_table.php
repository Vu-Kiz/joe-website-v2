<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_item_types', function (Blueprint $table) {
            $table->string('class_uid')->nullable()->after('name');
            $table->string('class_name')->nullable()->after('class_uid');
        });
    }

    public function down(): void
    {
        Schema::table('swc_item_types', function (Blueprint $table) {
            $table->dropColumn(['class_uid', 'class_name']);
        });
    }
};
