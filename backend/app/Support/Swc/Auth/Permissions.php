<?php

namespace App\Support\Swc\Auth;

use Illuminate\Contracts\Auth\Authenticatable;

final class Permissions
{
    public static function isSysadmin(?Authenticatable $user): bool
    {
        return (bool) data_get($user, 'is_sysadmin', false);
    }

    public static function hasFlag(?Authenticatable $user, string $flag, bool $sysadminOverrides = true): bool
    {
        if (!$user) {
            return false;
        }

        if ($sysadminOverrides && self::isSysadmin($user)) {
            return true;
        }

        return (bool) data_get($user, $flag, false);
    }

    public static function hasAny(?Authenticatable $user, array $flags, bool $sysadminOverrides = true): bool
    {
        if (!$user) {
            return false;
        }

        if ($sysadminOverrides && self::isSysadmin($user)) {
            return true;
        }

        foreach ($flags as $flag) {
            if (is_string($flag) && $flag !== '' && (bool) data_get($user, $flag, false)) {
                return true;
            }
        }

        return false;
    }

    public static function hasAll(?Authenticatable $user, array $flags, bool $sysadminOverrides = true): bool
    {
        if (!$user) {
            return false;
        }

        if ($sysadminOverrides && self::isSysadmin($user)) {
            return true;
        }

        foreach ($flags as $flag) {
            if (!is_string($flag) || $flag === '' || !(bool) data_get($user, $flag, false)) {
                return false;
            }
        }

        return true;
    }
}