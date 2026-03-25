<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcAuthorization extends Model
{
    protected $table = 'swc_authorizations';

    protected $fillable = [
        'user_id',
        'user_swc_account_id',
        'swc_character_id',
        'granted_scopes',
        'has_personal_credit_log_access',
        'has_faction_credit_log_access',
        'has_character_privileges_access',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_expires_at',
        'last_verified_at',
        'revoked_at',
    ];

    protected $casts = [
        'has_personal_credit_log_access' => 'boolean',
        'has_faction_credit_log_access' => 'boolean',
        'has_character_privileges_access' => 'boolean',
        'token_expires_at' => 'datetime',
        'last_verified_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function userSwcAccount(): BelongsTo
    {
        return $this->belongsTo(UserSwcAccount::class);
    }
}
