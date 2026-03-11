<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('swc_users', 'can_manage_tips')) {
                $table->boolean('can_manage_tips')->default(false)->after('can_manage_blog');
            }

            if (!Schema::hasColumn('swc_users', 'can_manage_eotm')) {
                $table->boolean('can_manage_eotm')->default(false)->after('can_manage_tips');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('swc_users', 'can_manage_eotm')) {
                $table->dropColumn('can_manage_eotm');
            }

            if (Schema::hasColumn('swc_users', 'can_manage_tips')) {
                $table->dropColumn('can_manage_tips');
            }
        });
    }
};