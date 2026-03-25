<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class UserSwcAccount extends Model
{
    protected $table = 'user_swc_accounts';

    protected $fillable = [
        'user_id',
        'swc_character_id',
        'swc_handle',
        'swc_avatar_url',
        'is_primary',
        'linked_at',
        'last_seen_at',
        'unlinked_at',
        'meta',
    ];

    protected $casts = [
        'swc_character_id' => 'integer',
        'is_primary' => 'boolean',
        'linked_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'unlinked_at' => 'datetime',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function swcAuthorization(): HasOne
    {
        return $this->hasOne(SwcAuthorization::class);
    }
}
