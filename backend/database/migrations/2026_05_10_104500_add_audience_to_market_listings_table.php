<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->string('audience', 32)->default('public')->after('channel');
            $table->index(['audience', 'status']);
        });

        DB::table('market_listings')
            ->whereNull('audience')
            ->update(['audience' => 'public']);
    }

    public function down(): void
    {
        Schema::table('market_listings', function (Blueprint $table) {
            $table->dropIndex(['audience', 'status']);
            $table->dropColumn('audience');
        });
    }
};
