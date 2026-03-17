<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transfers', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_transfers', 'verified_transaction_id')) {
                $table->unsignedBigInteger('verified_transaction_id')->nullable()->after('verified_event_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payment_transfers', function (Blueprint $table) {
            if (Schema::hasColumn('payment_transfers', 'verified_transaction_id')) {
                $table->dropColumn('verified_transaction_id');
            }
        });
    }
};