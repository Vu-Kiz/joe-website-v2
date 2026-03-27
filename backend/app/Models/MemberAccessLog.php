<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberAccessLog extends Model
{
    protected $table = 'member_access_logs';

    public $timestamps = false;

    protected $fillable = [
        'actor_user_id',
        'actor_handle',
        'area',
        'action',
        'request_method',
        'request_path',
        'summary',
        'response_status',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'actor_user_id' => 'integer',
        'response_status' => 'integer',
        'created_at' => 'datetime',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
