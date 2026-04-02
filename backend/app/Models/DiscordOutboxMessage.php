<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DiscordOutboxMessage extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'notification_key',
        'status',
        'attempts',
        'content',
        'meta',
        'claimed_at',
        'sent_at',
        'error_message',
    ];

    protected $casts = [
        'meta' => 'array',
        'claimed_at' => 'datetime',
        'sent_at' => 'datetime',
    ];
}
