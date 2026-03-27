<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_planets', function (Blueprint $table): void {
            $table->string('planet_type_uid')->nullable()->after('owner_name');
            $table->string('planet_type_name')->nullable()->after('planet_type_uid');
            $table->string('planet_type_href')->nullable()->after('planet_type_name');
        });
    }

    public function down(): void
    {
        Schema::table('swc_planets', function (Blueprint $table): void {
            $table->dropColumn([
                'planet_type_uid',
                'planet_type_name',
                'planet_type_href',
            ]);
        });
    }
};
