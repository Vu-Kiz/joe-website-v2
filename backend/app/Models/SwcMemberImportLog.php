<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcMemberImportLog extends Model
{
    protected $fillable = [
        'user_id',
        'events_seen',
        'events_matched',
        'created',
        'updated',
        'unchanged',
        'skipped',
        'areas',
    ];

    protected $casts = [
        'areas' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
