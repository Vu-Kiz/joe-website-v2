<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            $table->boolean('has_character_privileges_access')
                ->default(false)
                ->after('has_faction_events_access');
        });
    }

    public function down(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            $table->dropColumn('has_character_privileges_access');
        });
    }
};