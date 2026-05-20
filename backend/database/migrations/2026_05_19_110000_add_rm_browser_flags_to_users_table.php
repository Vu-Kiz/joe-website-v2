<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('can_access_rm_browser')->default(false)->after('can_access_fleet_commander');
            $table->boolean('is_rm_browser_service_account')->default(false)->after('can_access_rm_browser');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['can_access_rm_browser', 'is_rm_browser_service_account']);
        });
    }
};
