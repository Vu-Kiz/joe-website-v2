<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_items', function (Blueprint $table) {
            $table->dropUnique('payment_items_source_type_source_id_unique');
            $table->unsignedBigInteger('pending_dedupe_id')->nullable()->after('source_id');
        });

        // Backfill: only pending rows hold a dedupe slot. Rows that already moved
        // past pending (attached/paid/cancelled) are historical and must not block
        // a future reward cycle from creating a fresh pending row.
        DB::table('payment_items')
            ->where('status', 'pending')
            ->update(['pending_dedupe_id' => DB::raw('source_id')]);

        Schema::table('payment_items', function (Blueprint $table) {
            $table->unique(['source_type', 'pending_dedupe_id'], 'payment_items_source_type_pending_dedupe_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('payment_items', function (Blueprint $table) {
            $table->dropUnique('payment_items_source_type_pending_dedupe_id_unique');
            $table->dropColumn('pending_dedupe_id');
            $table->unique(['source_type', 'source_id'], 'payment_items_source_type_source_id_unique');
        });
    }
};
