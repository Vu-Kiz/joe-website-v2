<?php

namespace App\Support\Admin;

use Illuminate\Support\Facades\DB;

class SiteLock
{
    public const KEY_ENABLED = 'site_lock_enabled';
    public const KEY_MESSAGE = 'site_lock_message';
    public const KEY_UPDATED_AT = 'site_lock_updated_at';
    public const KEY_UPDATED_BY = 'site_lock_updated_by';

    public static function isEnabled(): bool
    {
        return self::getBool(self::KEY_ENABLED, false);
    }

    public static function getMessage(): string
    {
        $msg = trim(self::getString(
            self::KEY_MESSAGE,
            'The site is temporarily unavailable. Please try again shortly.'
        ));

        return $msg !== ''
            ? $msg
            : 'The site is temporarily unavailable. Please try again shortly.';
    }

    public static function getMeta(): array
    {
        return [
            'enabled'    => self::isEnabled(),
            'message'    => self::getMessage(),
            'updated_at' => self::getString(self::KEY_UPDATED_AT, ''),
            'updated_by' => self::getString(self::KEY_UPDATED_BY, ''),
        ];
    }

    public static function setLock(bool $enabled, string $message, string $updatedBy = ''): void
    {
        $now = now()->format('Y-m-d H:i:s');

        self::setString(self::KEY_ENABLED, $enabled ? '1' : '0');
        self::setString(self::KEY_MESSAGE, $message);
        self::setString(self::KEY_UPDATED_AT, $now);
        self::setString(self::KEY_UPDATED_BY, $updatedBy);
    }

    protected static function getString(string $key, string $default = ''): string
    {
        $value = DB::table('app_settings')
            ->where('key', $key)
            ->value('value');

        return $value === null ? $default : (string) $value;
    }

    protected static function getBool(string $key, bool $default = false): bool
    {
        $value = self::getString($key, $default ? '1' : '0');

        return $value === '1'
            || strcasecmp($value, 'true') === 0
            || strcasecmp($value, 'yes') === 0;
    }

    protected static function setString(string $key, string $value): void
    {
        DB::table('app_settings')->updateOrInsert(
            ['key' => $key],
            ['value' => $value]
        );
    }
}