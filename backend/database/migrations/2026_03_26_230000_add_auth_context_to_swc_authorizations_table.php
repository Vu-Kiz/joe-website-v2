<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();

        $result = DB::selectOne(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $indexName]
        );

        return $result !== null;
    }

    public function up(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            if (!Schema::hasColumn('swc_authorizations', 'auth_context')) {
                $table->string('auth_context', 32)
                    ->default('payments')
                    ->after('swc_character_id');
            }
        });

        DB::table('swc_authorizations')
            ->whereNull('auth_context')
            ->update(['auth_context' => 'payments']);

        Schema::table('swc_authorizations', function (Blueprint $table) {
            if (!$this->indexExists('swc_authorizations', 'swc_auth_user_idx')) {
                $table->index('user_id', 'swc_auth_user_idx');
            }
        });

        Schema::table('swc_authorizations', function (Blueprint $table) {
            if ($this->indexExists('swc_authorizations', 'swc_event_auth_user_unique')) {
                $table->dropUnique('swc_event_auth_user_unique');
            }

            if (!$this->indexExists('swc_authorizations', 'swc_auth_user_context_unique')) {
                $table->unique(['user_id', 'auth_context'], 'swc_auth_user_context_unique');
            }

            if (!$this->indexExists('swc_authorizations', 'swc_auth_user_context_idx')) {
                $table->index(['user_id', 'auth_context'], 'swc_auth_user_context_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('swc_authorizations', function (Blueprint $table) {
            if ($this->indexExists('swc_authorizations', 'swc_auth_user_context_unique')) {
                $table->dropUnique('swc_auth_user_context_unique');
            }

            if ($this->indexExists('swc_authorizations', 'swc_auth_user_context_idx')) {
                $table->dropIndex('swc_auth_user_context_idx');
            }

            if (!$this->indexExists('swc_authorizations', 'swc_event_auth_user_unique')) {
                $table->unique('user_id', 'swc_event_auth_user_unique');
            }
        });

        Schema::table('swc_authorizations', function (Blueprint $table) {
            if ($this->indexExists('swc_authorizations', 'swc_auth_user_idx')) {
                $table->dropIndex('swc_auth_user_idx');
            }
        });

        Schema::table('swc_authorizations', function (Blueprint $table) {
            if (Schema::hasColumn('swc_authorizations', 'auth_context')) {
                $table->dropColumn('auth_context');
            }
        });
    }
};
