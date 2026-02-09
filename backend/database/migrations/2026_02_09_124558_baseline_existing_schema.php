<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Baseline migration for the existing JOEnet / appdb schema.
     * This intentionally makes NO schema changes.
     */
    public function up(): void
    {
        // Intentionally empty – legacy schema already exists (appdb).
    }

    /**
     * We do not roll back the legacy schema.
     */
    public function down(): void
    {
        // Intentionally empty.
    }
};
