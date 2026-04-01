<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_creature_types', function (Blueprint $table) {
            $table->json('weapons')->nullable()->after('skills');
        });
    }

    public function down(): void
    {
        Schema::table('swc_creature_types', function (Blueprint $table) {
            $table->dropColumn([
                'weapons',
            ]);
        });
    }
};
