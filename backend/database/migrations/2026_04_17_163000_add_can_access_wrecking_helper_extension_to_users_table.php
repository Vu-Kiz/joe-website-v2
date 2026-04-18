<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'can_access_wrecking_helper_extension')) {
                $table->boolean('can_access_wrecking_helper_extension')
                    ->default(false)
                    ->after('can_access_combat_calc');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'can_access_wrecking_helper_extension')) {
                $table->dropColumn('can_access_wrecking_helper_extension');
            }
        });
    }
};
