<?php

namespace App\Support\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class SupportTicketSettings
{
    public const KEY_RECIPIENT_USER_ID = 'support_ticket_recipient_user_id';

    public static function getRecipientUserId(): ?int
    {
        $value = DB::table('app_settings')
            ->where('key', self::KEY_RECIPIENT_USER_ID)
            ->value('value');

        if ($value === null || trim((string) $value) === '' || !is_numeric($value)) {
            return null;
        }

        return (int) $value;
    }

    public static function getRecipient(): ?User
    {
        $userId = self::getRecipientUserId();
        if (!$userId) {
            return null;
        }

        return User::query()
            ->whereKey($userId)
            ->whereNotNull('discord_user_id')
            ->first();
    }

    public static function setRecipientUserId(?int $userId): void
    {
        DB::table('app_settings')->updateOrInsert(
            ['key' => self::KEY_RECIPIENT_USER_ID],
            ['value' => $userId !== null ? (string) $userId : null]
        );
    }

    public static function candidateRecipients()
    {
        return User::query()
            ->whereNotNull('discord_user_id')
            ->where(function ($q) {
                $q->where('is_sysadmin', true)->orWhere('is_admin', true);
            })
            ->orderByRaw('is_sysadmin DESC, is_admin DESC, COALESCE(swc_handle, discord_global_name, discord_username)')
            ->get([
                'id',
                'swc_handle',
                'discord_user_id',
                'discord_username',
                'discord_global_name',
                'is_admin',
                'is_sysadmin',
            ]);
    }
}
