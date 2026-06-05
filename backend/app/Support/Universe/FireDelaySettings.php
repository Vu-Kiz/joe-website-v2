<?php

namespace App\Support\Universe;

use Illuminate\Support\Facades\DB;

class FireDelaySettings
{
    private const KEY_FACTION_UID = 'fire_delay_faction_uid';
    private const DEFAULT_FACTION_UID = 1796; // Jawa Offworld Enterprises: RAID

    public static function getFactionUid(): int
    {
        $value = DB::table('app_settings')
            ->where('key', self::KEY_FACTION_UID)
            ->value('value');

        return $value !== null && is_numeric($value)
            ? (int) $value
            : self::DEFAULT_FACTION_UID;
    }

    public static function setFactionUid(int $uid): void
    {
        DB::table('app_settings')->updateOrInsert(
            ['key' => self::KEY_FACTION_UID],
            ['value' => (string) $uid]
        );
    }

    public static function toArray(): array
    {
        return [
            'faction_uid'         => self::getFactionUid(),
            'default_faction_uid' => self::DEFAULT_FACTION_UID,
        ];
    }
}
