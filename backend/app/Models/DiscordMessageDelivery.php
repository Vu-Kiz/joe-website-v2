<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DiscordMessageDelivery extends Model
{
    protected $fillable = [
        'notification_key',
        'source_type',
        'source_id',
        'guild_id',
        'channel_id',
        'message_ids',
        'last_sent_at',
    ];

    protected $casts = [
        'message_ids' => 'array',
        'last_sent_at' => 'datetime',
    ];
}
