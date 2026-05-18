<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tool_subscriptions', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('activated_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('tool_subscriptions', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
    }
};
