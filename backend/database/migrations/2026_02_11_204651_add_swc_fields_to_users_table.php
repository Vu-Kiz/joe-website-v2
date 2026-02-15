<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // --- SWC identity ---
            $table->unsignedBigInteger('swc_character_id')
                ->unique()
                ->after('id');

            $table->string('swc_handle', 100)
                ->after('swc_character_id');

            $table->string('swc_avatar_url', 255)
                ->nullable()
                ->after('swc_handle');

            // --- Permission flags (don’t depend on email existing) ---
            $table->boolean('is_joe_member')
                ->default(false)
                ->after('swc_avatar_url');

            $table->boolean('is_admin')
                ->default(false)
                ->after('is_joe_member');

            $table->boolean('is_sysadmin')
                ->default(false)
                ->after('is_admin');

            $table->boolean('is_intel')
                ->default(false)
                ->after('is_sysadmin');

            $table->boolean('is_garry')
                ->default(false)
                ->after('is_intel');

            $table->boolean('is_raid')
                ->default(false)
                ->after('is_garry');

            // --- Drop stock Laravel auth columns you don’t need ---
            $table->dropColumn([
                'name',
                'email',
                'email_verified_at',
                'password',
                'remember_token',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // Recreate the columns we dropped
            $table->string('name')->nullable();
            $table->string('email')->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();

            // Drop the SWC-specific fields
            $table->dropColumn([
                'swc_character_id',
                'swc_handle',
                'swc_avatar_url',
                'is_joe_member',
                'is_admin',
                'is_sysadmin',
                'is_intel',
                'is_garry',
                'is_raid',
            ]);
        });
    }
};
