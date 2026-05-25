<?php

namespace App\Models\Job;
use App\Models\User;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobAssignment extends Model
{
    protected $fillable = [
        'job_id',
        'worker_user_id',
        'worker_swc_uid',
        'worker_handle',
        'status',
        'days_taken',
        'completed_at',
        'meta',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'meta' => 'array',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class);
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'worker_user_id');
    }
}