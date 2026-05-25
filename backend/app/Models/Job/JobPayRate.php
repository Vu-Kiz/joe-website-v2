<?php

namespace App\Models\Job;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobPayRate extends Model
{
    protected $fillable = [
        'name',
        'description',
        'unit_label',
        'base_rate',
        'bonus_rate',
        'bonus_description',
        'payer_subject_type',
        'payer_subject_id',
        'payer_label',
        'status',
        'created_by_user_id',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function claims(): HasMany
    {
        return $this->hasMany(JobPayClaim::class);
    }
}
