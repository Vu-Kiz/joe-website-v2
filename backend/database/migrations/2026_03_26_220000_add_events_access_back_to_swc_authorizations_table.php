<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            if (!Schema::hasColumn('swc_authorizations', 'has_personal_events_access')) {
                $table->boolean('has_personal_events_access')
                    ->default(false)
                    ->after('granted_scopes');
            }

            if (!Schema::hasColumn('swc_authorizations', 'has_faction_events_access')) {
                $table->boolean('has_faction_events_access')
                    ->default(false)
                    ->after('has_personal_events_access');
            }
        });
    }

    public function down(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            if (Schema::hasColumn('swc_authorizations', 'has_faction_events_access')) {
                $table->dropColumn('has_faction_events_access');
            }

            if (Schema::hasColumn('swc_authorizations', 'has_personal_events_access')) {
                $table->dropColumn('has_personal_events_access');
            }
        });
    }
};
