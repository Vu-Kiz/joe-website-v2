<?php

namespace App\Models\Discord;

use Illuminate\Database\Eloquent\Model;

class DiscordBotGuild extends Model
{
    protected $fillable = [
        'guild_id',
        'guild_name',
        'icon_url',
        'member_count',
        'available',
        'last_seen_at',
    ];

    protected $casts = [
        'available' => 'boolean',
        'member_count' => 'integer',
        'last_seen_at' => 'datetime',
    ];
}
