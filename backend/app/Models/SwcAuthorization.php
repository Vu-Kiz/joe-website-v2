<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcAuthorization extends Model
{
    protected $fillable = [
        'user_id',
        'swc_character_id',
        'granted_scopes',
        'has_personal_events_access',
        'has_faction_events_access',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_expires_at',
        'last_verified_at',
        'revoked_at',
    ];

    protected $casts = [
        'has_personal_events_access' => 'boolean',
        'has_faction_events_access' => 'boolean',
        'token_expires_at' => 'datetime',
        'last_verified_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}