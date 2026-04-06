<?php

namespace App\Support\Contact;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ContactRequestSettings
{
    public const KEY_DEFAULT_RECIPIENT_USER_ID = 'contact_request_default_recipient_user_id';

    public static function getDefaultRecipientUserId(): ?int
    {
        $value = DB::table('app_settings')
            ->where('key', self::KEY_DEFAULT_RECIPIENT_USER_ID)
            ->value('value');

        if ($value === null || trim((string) $value) === '' || !is_numeric($value)) {
            return null;
        }

        return (int) $value;
    }

    public static function getDefaultRecipient(): ?User
    {
        $userId = self::getDefaultRecipientUserId();
        if (!$userId) {
            return null;
        }

        return User::query()
            ->whereKey($userId)
            ->whereNotNull('discord_user_id')
            ->first();
    }

    public static function setDefaultRecipientUserId(?int $userId): void
    {
        DB::table('app_settings')->updateOrInsert(
            ['key' => self::KEY_DEFAULT_RECIPIENT_USER_ID],
            ['value' => $userId !== null ? (string) $userId : null]
        );
    }

    public static function candidateRecipients()
    {
        return User::query()
            ->whereNotNull('discord_user_id')
            ->orderByRaw('COALESCE(swc_handle, discord_global_name, discord_username)')
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

    public static function meta(): array
    {
        $recipient = self::getDefaultRecipient();

        return [
            'default_recipient' => $recipient ? [
                'id' => (int) $recipient->id,
                'swc_handle' => $recipient->swc_handle,
                'discord_user_id' => $recipient->discord_user_id,
                'discord_username' => $recipient->discord_username,
                'discord_global_name' => $recipient->discord_global_name,
                'is_admin' => (bool) $recipient->is_admin,
                'is_sysadmin' => (bool) $recipient->is_sysadmin,
            ] : null,
        ];
    }
}
