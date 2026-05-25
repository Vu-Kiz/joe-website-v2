<?php

namespace App\Models\Job;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobPayClaim extends Model
{
    protected $fillable = [
        'job_pay_rate_id',
        'claimant_user_id',
        'claimant_swc_uid',
        'claimant_handle',
        'quantity',
        'include_bonus',
        'base_total',
        'bonus_total',
        'total_amount',
        'notes',
        'status',
        'reviewed_by_user_id',
        'reviewed_at',
        'review_note',
        'payment_item_id',
        'meta',
    ];

    protected $casts = [
        'include_bonus' => 'boolean',
        'reviewed_at' => 'datetime',
        'meta' => 'array',
    ];

    public function payRate(): BelongsTo
    {
        return $this->belongsTo(JobPayRate::class, 'job_pay_rate_id');
    }

    public function claimant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimant_user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function paymentItem(): BelongsTo
    {
        return $this->belongsTo(PaymentItem::class, 'payment_item_id');
    }
}
