<?php

namespace App\Models\ToolStore;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ToolSubscriptionPlan extends Model
{
    protected $fillable = [
        'key',
        'label',
        'description',
        'monthly_price_credits',
        'is_active',
        'updated_by_user_id',
    ];

    protected $casts = [
        'monthly_price_credits' => 'integer',
        'is_active' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function factionDeals(): HasMany
    {
        return $this->hasMany(ToolSubscriptionFactionDeal::class, 'plan_key', 'key');
    }
}
