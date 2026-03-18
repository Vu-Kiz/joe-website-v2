<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faction_user', function (Blueprint $table) {
            if (!Schema::hasColumn('faction_user', 'can_manage_manual_payments')) {
                $table->boolean('can_manage_manual_payments')
                    ->default(false)
                    ->after('can_pay_from_faction');
            }
        });
    }

    public function down(): void
    {
        Schema::table('faction_user', function (Blueprint $table) {
            if (Schema::hasColumn('faction_user', 'can_manage_manual_payments')) {
                $table->dropColumn('can_manage_manual_payments');
            }
        });
    }
};