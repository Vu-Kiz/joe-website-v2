<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swc_races', function (Blueprint $table) {
            $table->unsignedInteger('force_probability')->nullable()->after('description');
            $table->integer('hp_bonus')->nullable()->after('force_probability');
            $table->decimal('hp_multiplier', 8, 2)->nullable()->after('hp_bonus');
            $table->string('homeworld_uid')->nullable()->index()->after('hp_multiplier');
            $table->string('homeworld_name')->nullable()->index()->after('homeworld_uid');
            $table->text('homeworld_href')->nullable()->after('homeworld_name');
            $table->json('skills')->nullable()->after('homeworld_href');
            $table->json('terrain_restrictions')->nullable()->after('skills');
        });
    }

    public function down(): void
    {
        Schema::table('swc_races', function (Blueprint $table) {
            $table->dropColumn([
                'force_probability',
                'hp_bonus',
                'hp_multiplier',
                'homeworld_uid',
                'homeworld_name',
                'homeworld_href',
                'skills',
                'terrain_restrictions',
            ]);
        });
    }
};
