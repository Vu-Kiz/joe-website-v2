<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminActionLog extends Model
{
    protected $table = 'admin_action_logs';

    public $timestamps = false;

    protected $fillable = [
        'actor_user_id',
        'actor_handle',
        'area',
        'action',
        'target_type',
        'target_id',
        'summary',
        'before_json',
        'after_json',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'actor_user_id' => 'integer',
        'target_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}