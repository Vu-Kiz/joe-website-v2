<?php

namespace App\Models\Swc;
use App\Models\Faction;
use App\Models\User;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcFactionPrivilegeCache extends Model
{
    protected $table = 'swc_faction_privilege_cache';

    protected $fillable = [
        'user_id',
        'faction_id',
        'privilege_group',
        'privilege_name',
        'is_allowed',
        'checked_at',
        'meta',
    ];

    protected $casts = [
        'is_allowed' => 'boolean',
        'checked_at' => 'datetime',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function faction(): BelongsTo
    {
        return $this->belongsTo(Faction::class);
    }
}