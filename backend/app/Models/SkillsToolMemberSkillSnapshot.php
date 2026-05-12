<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SkillsToolMemberSkillSnapshot extends Model
{
    protected $table = 'skills_tool_member_skill_snapshots';

    protected $fillable = [
        'user_id',
        'swc_character_id',
        'swc_uid',
        'swc_handle',
        'skills_payload',
        'upstream_status',
        'auth_mode',
        'fetched_at',
        'last_attempted_at',
        'error_message',
    ];

    protected $casts = [
        'skills_payload' => 'array',
        'upstream_status' => 'integer',
        'fetched_at' => 'datetime',
        'last_attempted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
