<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DiscordBotGuild;
use App\Models\DiscordChannelConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;

class DiscordBotAdminController extends Controller
{
    public function show(): JsonResponse
    {
        $clientId = trim((string) Config::get('services.discord_bot.client_id', ''));
        $permissions = (string) Config::get('services.discord_bot.invite_permissions', '277025801280');
        $scopes = (string) Config::get('services.discord_bot.invite_scopes', 'bot applications.commands');

        $inviteUrl = '';
        if ($clientId !== '') {
            $inviteUrl = 'https://discord.com/oauth2/authorize?client_id='
                . urlencode($clientId)
                . '&permissions=' . urlencode($permissions)
                . '&scope=' . urlencode($scopes);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'client_id' => $clientId !== '' ? $clientId : null,
                'invite_url' => $inviteUrl !== '' ? $inviteUrl : null,
                'known_guilds' => DiscordBotGuild::query()
                    ->orderBy('guild_name')
                    ->get([
                        'id',
                        'guild_id',
                        'guild_name',
                        'icon_url',
                        'member_count',
                        'available',
                        'last_seen_at',
                    ]),
                'channel_configs' => DiscordChannelConfig::query()
                    ->orderBy('notification_key')
                    ->get([
                        'id',
                        'notification_key',
                        'guild_id',
                        'channel_id',
                        'channel_name',
                        'set_by_user_id',
                        'set_by_discord_user_id',
                        'updated_at',
                    ]),
            ],
        ]);
    }
}
