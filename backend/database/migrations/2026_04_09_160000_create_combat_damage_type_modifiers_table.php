<?php

use App\Support\Combat\CombatMathSettings;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('combat_damage_type_modifiers', function (Blueprint $table) {
            $table->id();
            $table->string('target_family', 100);
            $table->string('damage_type_key', 150);
            $table->decimal('multiplier', 8, 4)->default(1);
            $table->timestamps();

            $table->unique(['target_family', 'damage_type_key'], 'combat_damage_type_modifiers_family_type_unique');
        });

        $now = now();

        $rows = collect(CombatMathSettings::defaultShipDamageTypeModifiers())
            ->map(fn (float $multiplier, string $damageTypeKey) => [
                'target_family' => CombatMathSettings::TARGET_FAMILY_SHIP,
                'damage_type_key' => $damageTypeKey,
                'multiplier' => $multiplier,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->values()
            ->all();

        if ($rows !== []) {
            DB::table('combat_damage_type_modifiers')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('combat_damage_type_modifiers');
    }
};
