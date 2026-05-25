<?php

namespace App\Models\Discord;
use App\Models\User;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscordChannelConfig extends Model
{
    protected $fillable = [
        'notification_key',
        'guild_id',
        'channel_id',
        'channel_name',
        'set_by_user_id',
        'set_by_discord_user_id',
    ];

    public function setter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'set_by_user_id');
    }
}
