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
        Schema::create('combat_ship_class_modifiers', function (Blueprint $table) {
            $table->id();
            $table->string('damage_type_key', 150);
            $table->string('attacker_class_key', 100);
            $table->string('defender_class_key', 100);
            $table->decimal('multiplier', 8, 4)->default(1);
            $table->timestamps();

            $table->unique(
                ['damage_type_key', 'attacker_class_key', 'defender_class_key'],
                'combat_ship_class_modifiers_unique'
            );
        });

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

        if ($rows !== []) {
            DB::table('combat_ship_class_modifiers')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('combat_ship_class_modifiers');
    }
};
