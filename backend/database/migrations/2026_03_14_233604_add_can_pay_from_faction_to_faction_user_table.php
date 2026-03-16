<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faction_user', function (Blueprint $table) {
            $table->boolean('can_pay_from_faction')
                ->default(false)
                ->after('can_view_payments');
        });
    }

    public function down(): void
    {
        Schema::table('faction_user', function (Blueprint $table) {
            $table->dropColumn('can_pay_from_faction');
        });
    }
};