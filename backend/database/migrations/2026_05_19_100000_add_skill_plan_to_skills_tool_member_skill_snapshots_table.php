<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('skills_tool_member_skill_snapshots', function (Blueprint $table) {
            $table->json('skill_plan')->nullable()->after('skills_payload');
        });
    }

    public function down(): void
    {
        Schema::table('skills_tool_member_skill_snapshots', function (Blueprint $table) {
            $table->dropColumn('skill_plan');
        });
    }
};
