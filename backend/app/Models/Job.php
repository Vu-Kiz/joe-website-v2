<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Job extends Model
{
    protected $fillable = [
        'title',
        'description',
        'status',
        'job_mode',
        'pay_type',
        'reward_amount',
        'bonus_amount',
        'bonus_reward',
        'bonus_note',
        'payer_subject_type',
        'payer_subject_id',
        'payer_label',
        'created_by_user_id',
        'created_by_swc_uid',
        'created_by_handle',
        'assigned_to_user_id',
        'assigned_to_swc_uid',
        'assigned_to_handle',
        'days_taken',
        'completed_at',
        'closed_at',
        'meta',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'closed_at' => 'datetime',
        'meta' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(JobAssignment::class);
    }
}