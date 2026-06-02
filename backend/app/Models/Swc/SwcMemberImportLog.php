<?php

namespace App\Models\Swc;
use App\Models\User;

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
        'reward_breakdown',
    ];

    protected $casts = [
        'areas'            => 'array',
        'reward_breakdown' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
