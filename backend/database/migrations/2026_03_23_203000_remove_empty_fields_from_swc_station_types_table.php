<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_station_types', function (Blueprint $table) {
            $table->dropColumn([
                'category',
                'class_name',
                'size',
                'width',
                'height',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('swc_station_types', function (Blueprint $table) {
            $table->string('category')->nullable()->index()->after('name');
            $table->string('class_name')->nullable()->after('category');
            $table->unsignedInteger('size')->nullable()->after('class_name');
            $table->decimal('width', 10, 2)->nullable()->after('length');
            $table->decimal('height', 10, 2)->nullable()->after('width');
        });
    }
};
