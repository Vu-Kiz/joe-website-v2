<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bounty_contracts', function (Blueprint $table) {
            $table->integer('accepted_galx')->nullable()->after('contract_type');
            $table->integer('accepted_galy')->nullable()->after('accepted_galx');
        });
    }

    public function down(): void
    {
        Schema::table('bounty_contracts', function (Blueprint $table) {
            $table->dropColumn(['accepted_galx', 'accepted_galy']);
        });
    }
};
