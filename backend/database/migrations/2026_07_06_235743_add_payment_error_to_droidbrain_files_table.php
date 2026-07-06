<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('droidbrain_files', function (Blueprint $table) {
            $table->text('payment_error')->nullable()->after('payment_status');
        });
    }

    public function down(): void
    {
        Schema::table('droidbrain_files', function (Blueprint $table) {
            $table->dropColumn('payment_error');
        });
    }
};
