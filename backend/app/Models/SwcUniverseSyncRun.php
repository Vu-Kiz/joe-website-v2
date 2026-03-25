<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcUniverseSyncRun extends Model
{
    protected $fillable = [
        'mode',
        'status',
        'requested_by_user_id',
        'options',
        'progress',
        'stats',
        'last_message',
        'error_message',
        'queued_at',
        'started_at',
        'finished_at',
        'next_retry_at',
    ];

    protected $casts = [
        'options' => 'array',
        'progress' => 'array',
        'stats' => 'array',
        'queued_at' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'next_retry_at' => 'datetime',
    ];

    public function requestedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }
}
