<?php

namespace App\Models\ToolStore;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ToolSubscription extends Model
{
    protected $fillable = [
        'subscriber_type',
        'subscriber_id',
        'plan_key',
        'status',
        'price_paid_credits',
        'seat_count',
        'current_period_start',
        'current_period_end',
        'revoked_at',
        'activated_by_user_id',
        'meta',
    ];

    protected $casts = [
        'price_paid_credits' => 'integer',
        'seat_count' => 'integer',
        'current_period_start' => 'datetime',
        'current_period_end' => 'datetime',
        'revoked_at' => 'datetime',
        'meta' => 'array',
    ];

    public function activatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'activated_by_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ToolSubscriptionMember::class);
    }
}
