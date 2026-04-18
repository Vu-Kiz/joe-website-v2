<?php

use App\Support\Combat\CombatMathSettings;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('combat_ship_class_modifiers')) {
            return;
        }

        $now = now();
        $rows = [];

        foreach (CombatMathSettings::defaultShipClassModifiers() as $damageTypeKey => $attackerRows) {
            foreach ($attackerRows as $attackerClassKey => $defenderRows) {
                foreach ($defenderRows as $defenderClassKey => $multiplier) {
                    $rows[] = [
                        'damage_type_key' => $damageTypeKey,
                        'attacker_class_key' => $attackerClassKey,
                        'defender_class_key' => $defenderClassKey,
                        'multiplier' => $multiplier,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        DB::transaction(function () use ($rows) {
            DB::table('combat_ship_class_modifiers')->delete();

            if ($rows !== []) {
                DB::table('combat_ship_class_modifiers')->insert($rows);
            }
        });
    }

    public function down(): void
    {
    }
};
