<?php

namespace App\Support\Combat;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CombatMathSettings
{
    public const TARGET_FAMILY_SHIP = 'ship';

    public static function shipClasses(): array
    {
        return [
            'super capitals',
            'capital ships',
            'frigates',
            'corvettes',
            'heavy freighters',
            'light freighters',
            'gunboats',
            'bombers',
            'fighters',
            'satellites',
            'cargo containers',
        ];
    }

    public static function weaponDamageTypes(): array
    {
        return [
            'energy (heavy)',
            'explosive (heavy)',
            'ionic (heavy)',
            'concussive (heavy)',
            'turbolaser (heavy)',
        ];
    }

    public static function getShipDamageTypeModifiers(): array
    {
        if (!Schema::hasTable('combat_damage_type_modifiers')) {
            return self::defaultShipDamageTypeModifiers();
        }

        $stored = DB::table('combat_damage_type_modifiers')
            ->where('target_family', self::TARGET_FAMILY_SHIP)
            ->orderBy('damage_type_key')
            ->get(['damage_type_key', 'multiplier']);

        $modifiers = [];

        foreach ($stored as $row) {
            $key = trim(mb_strtolower((string) $row->damage_type_key));
            if ($key === '') {
                continue;
            }

            $modifiers[$key] = max(0, (float) $row->multiplier);
        }

        return self::normalizeShipDamageTypeModifiers($modifiers);
    }

    public static function setShipDamageTypeModifiers(array $modifiers): void
    {
        if (!Schema::hasTable('combat_damage_type_modifiers')) {
            return;
        }

        $normalized = self::normalizeShipDamageTypeModifiers($modifiers);
        $now = now();

        DB::transaction(function () use ($normalized, $now) {
            DB::table('combat_damage_type_modifiers')
                ->where('target_family', self::TARGET_FAMILY_SHIP)
                ->delete();

            $rows = collect($normalized)
                ->map(fn (float $multiplier, string $damageTypeKey) => [
                    'target_family' => self::TARGET_FAMILY_SHIP,
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
        });
    }

    public static function defaultShipDamageTypeModifiers(): array
    {
        return [
            'physical (personal)' => 0.10,
            'energy (personal)' => 0.10,
            'explosive (personal)' => 1.00,
            'ionic (personal)' => 0.10,
            'lightsaber' => 1.00,
            'poison' => 0.10,
            'nonlethal' => 0.10,
            'energy (force)' => 1.00,
            'physical (force)' => 1.00,
            'bonus (force)' => 1.00,
            'soft (force)' => 0.00,
            'physical (heavy)' => 1.00,
            'energy (heavy)' => 1.00,
            'explosive (heavy)' => 0.50,
            'ionic (heavy)' => 1.00,
            'concussive (heavy)' => 1.00,
            'turbolaser (heavy)' => 0.50,
            'energy (orbital)' => 1.00,
            'ionic (orbital)' => 1.00,
        ];
    }

    protected static function normalizeShipDamageTypeModifiers(array $modifiers): array
    {
        $normalized = self::defaultShipDamageTypeModifiers();

        foreach ($modifiers as $damageType => $multiplier) {
            $key = trim(mb_strtolower((string) $damageType));
            if ($key === '' || !is_numeric($multiplier)) {
                continue;
            }

            $normalized[$key] = max(0, (float) $multiplier);
        }

        ksort($normalized);

        return $normalized;
    }

    public static function getShipClassModifiers(): array
    {
        if (!Schema::hasTable('combat_ship_class_modifiers')) {
            return self::defaultShipClassModifiers();
        }

        $stored = DB::table('combat_ship_class_modifiers')
            ->orderBy('damage_type_key')
            ->orderBy('attacker_class_key')
            ->orderBy('defender_class_key')
            ->get(['damage_type_key', 'attacker_class_key', 'defender_class_key', 'multiplier']);

        $overrides = [];

        foreach ($stored as $row) {
            $damageTypeKey = trim(mb_strtolower((string) $row->damage_type_key));
            $attackerClassKey = trim(mb_strtolower((string) $row->attacker_class_key));
            $defenderClassKey = trim(mb_strtolower((string) $row->defender_class_key));

            if ($damageTypeKey === '' || $attackerClassKey === '' || $defenderClassKey === '') {
                continue;
            }

            $overrides[$damageTypeKey][$attackerClassKey][$defenderClassKey] = max(0, (float) $row->multiplier);
        }

        return self::normalizeShipClassModifiers($overrides);
    }

    public static function setShipClassModifiers(array $modifiers): void
    {
        if (!Schema::hasTable('combat_ship_class_modifiers')) {
            return;
        }

        $normalized = self::normalizeShipClassModifiers($modifiers);
        $now = now();
        $rows = [];

        foreach ($normalized as $damageTypeKey => $attackerRows) {
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

    public static function defaultShipClassModifiers(): array
    {
        $defaults = [];

        foreach (self::weaponDamageTypes() as $damageType) {
            foreach (self::shipClasses() as $attackerClass) {
                foreach (self::shipClasses() as $defenderClass) {
                    $defaults[$damageType][$attackerClass][$defenderClass] = 1.0;
                }
            }
        }

        $heavyOverrides = [
            'energy (heavy)' => [
                'super capitals' => [2.0, 3.0, 2.0, 1.0, 0.5, 0.5, 0.3, 0.3, 0.3, 1.0, 1.0],
                'capital ships' => [1.5, 2.0, 3.0, 2.0, 1.0, 1.0, 0.5, 0.5, 0.5, 1.0, 1.0],
                'frigates' => [1.0, 1.5, 1.5, 1.5, 2.0, 1.5, 3.0, 3.0, 3.0, 1.0, 1.0],
                'corvettes' => [0.5, 1.0, 1.5, 2.0, 3.0, 2.0, 4.0, 5.5, 5.5, 1.0, 1.0],
                'heavy freighters' => [0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.5, 1.0, 1.0],
                'light freighters' => [0.3, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.8, 1.8, 1.0, 1.0],
                'gunboats' => [0.1, 0.2, 0.3, 0.4, 1.0, 1.0, 0.8, 0.8, 0.8, 1.0, 1.0],
                'bombers' => [0.1, 0.2, 0.3, 0.1, 0.9, 0.9, 0.7, 0.7, 0.7, 1.0, 1.0],
                'fighters' => [0.1, 0.2, 0.1, 0.1, 0.9, 0.9, 0.9, 1.5, 2.0, 1.0, 1.0],
                'satellites' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'cargo containers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            ],
            'explosive (heavy)' => [
                'super capitals' => [2.0, 3.0, 2.0, 1.5, 1.0, 1.0, 0.5, 0.5, 0.5, 1.0, 1.0],
                'capital ships' => [1.5, 2.0, 3.0, 2.0, 1.5, 1.0, 0.5, 0.5, 0.5, 1.0, 1.0],
                'frigates' => [1.0, 2.0, 3.0, 3.0, 3.0, 1.0, 2.0, 1.5, 1.5, 1.0, 1.0],
                'corvettes' => [0.8, 1.0, 3.0, 2.0, 3.0, 1.0, 3.0, 2.0, 2.0, 1.0, 1.0],
                'heavy freighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'light freighters' => [0.5, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.8, 1.0, 1.0],
                'gunboats' => [1.0, 1.0, 0.8, 0.6, 1.0, 1.0, 0.5, 0.5, 0.5, 1.0, 1.0],
                'bombers' => [2.0, 1.8, 1.8, 1.0, 0.8, 0.5, 0.5, 0.3, 0.3, 1.0, 1.0],
                'fighters' => [1.0, 1.0, 1.0, 1.0, 0.8, 0.5, 0.5, 0.3, 0.3, 1.0, 1.0],
                'satellites' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'cargo containers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            ],
            'ionic (heavy)' => [
                'super capitals' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.2, 0.2, 1.0, 1.0],
                'capital ships' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.2, 0.2, 1.0, 1.0],
                'frigates' => [1.0, 1.0, 2.0, 2.0, 2.0, 1.0, 1.0, 2.0, 2.0, 1.0, 1.0],
                'corvettes' => [1.0, 1.0, 2.0, 2.0, 2.0, 1.5, 1.5, 2.0, 2.0, 1.0, 1.0],
                'heavy freighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.5, 1.0, 1.0],
                'light freighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'gunboats' => [3.0, 2.0, 2.0, 1.5, 2.0, 2.0, 1.5, 0.5, 0.4, 1.0, 1.0],
                'bombers' => [1.5, 1.5, 1.5, 0.5, 0.7, 0.8, 0.2, 0.4, 0.2, 1.0, 1.0],
                'fighters' => [1.0, 1.0, 1.0, 0.5, 0.7, 0.8, 0.4, 0.4, 0.4, 1.0, 1.0],
                'satellites' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'cargo containers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            ],
            'concussive (heavy)' => [
                'super capitals' => [0.3, 0.6, 1.0, 1.0, 2.0, 1.0, 0.5, 0.5, 0.5, 1.0, 1.0],
                'capital ships' => [0.1, 0.3, 0.6, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'frigates' => [0.1, 0.2, 0.3, 0.6, 2.0, 1.0, 2.0, 3.0, 3.0, 1.0, 1.0],
                'corvettes' => [0.1, 0.1, 0.3, 0.3, 2.0, 1.5, 3.0, 4.0, 4.0, 1.0, 1.0],
                'heavy freighters' => [0.3, 0.5, 1.0, 0.5, 1.0, 1.0, 1.0, 2.0, 2.0, 1.0, 1.0],
                'light freighters' => [0.1, 0.2, 0.4, 0.3, 1.0, 1.0, 1.0, 1.2, 1.2, 1.0, 1.0],
                'gunboats' => [0.2, 0.4, 0.2, 0.1, 1.0, 1.5, 0.5, 0.5, 0.5, 1.0, 1.0],
                'bombers' => [0.2, 0.2, 0.1, 0.1, 0.2, 0.6, 0.3, 0.2, 0.2, 1.0, 1.0],
                'fighters' => [0.2, 0.2, 0.1, 0.1, 0.2, 0.6, 0.2, 0.3, 0.5, 1.0, 1.0],
                'satellites' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'cargo containers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            ],
            'turbolaser (heavy)' => [
                'super capitals' => [2.0, 3.0, 4.0, 4.5, 4.5, 1.0, 0.5, 0.2, 0.2, 1.0, 1.0],
                'capital ships' => [1.5, 3.0, 3.5, 4.0, 4.0, 2.0, 1.0, 0.5, 0.5, 1.0, 1.0],
                'frigates' => [1.0, 2.0, 3.5, 4.0, 4.0, 1.0, 3.0, 1.0, 1.0, 1.0, 1.0],
                'corvettes' => [0.5, 1.0, 3.5, 4.0, 4.0, 1.0, 3.0, 2.0, 2.0, 1.0, 1.0],
                'heavy freighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'light freighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'gunboats' => [1.0, 1.0, 3.0, 2.5, 2.5, 1.0, 3.0, 2.0, 2.0, 1.0, 1.0],
                'bombers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'fighters' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'satellites' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                'cargo containers' => [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            ],
        ];

        $shipClasses = self::shipClasses();

        foreach ($heavyOverrides as $damageType => $attackerRows) {
            foreach ($attackerRows as $attackerClass => $defenderValues) {
                foreach ($shipClasses as $index => $defenderClass) {
                    $defaults[$damageType][$attackerClass][$defenderClass] = $defenderValues[$index] ?? 1.0;
                }
            }
        }

        return $defaults;
    }

    public static function resolveShipClassModifier(string $damageTypeKey, ?string $attackerClassName, ?string $defenderClassName): float
    {
        $damageType = trim(mb_strtolower($damageTypeKey));
        $attacker = trim(mb_strtolower((string) $attackerClassName));
        $defender = trim(mb_strtolower((string) $defenderClassName));

        if ($damageType === '' || $attacker === '' || $defender === '') {
            return 1.0;
        }

        $matrix = self::getShipClassModifiers();

        return (float) ($matrix[$damageType][$attacker][$defender] ?? 1.0);
    }

    protected static function normalizeShipClassModifiers(array $modifiers): array
    {
        $normalized = self::defaultShipClassModifiers();
        $validDamageTypes = array_flip(self::weaponDamageTypes());
        $validShipClasses = array_flip(self::shipClasses());

        foreach ($modifiers as $damageTypeKey => $attackerRows) {
            $damageType = trim(mb_strtolower((string) $damageTypeKey));
            if ($damageType === '' || !isset($validDamageTypes[$damageType]) || !is_array($attackerRows)) {
                continue;
            }

            foreach ($attackerRows as $attackerClassKey => $defenderRows) {
                $attackerClass = trim(mb_strtolower((string) $attackerClassKey));
                if ($attackerClass === '' || !isset($validShipClasses[$attackerClass]) || !is_array($defenderRows)) {
                    continue;
                }

                foreach ($defenderRows as $defenderClassKey => $multiplier) {
                    $defenderClass = trim(mb_strtolower((string) $defenderClassKey));
                    if ($defenderClass === '' || !isset($validShipClasses[$defenderClass]) || !is_numeric($multiplier)) {
                        continue;
                    }

                    $normalized[$damageType][$attackerClass][$defenderClass] = max(0, (float) $multiplier);
                }
            }
        }

        return $normalized;
    }
}
