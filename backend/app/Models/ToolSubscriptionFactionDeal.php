<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolSubscriptionFactionDeal extends Model
{
    protected $fillable = [
        'faction_id',
        'plan_key',
        'override_price_credits',
        'per_seat_price_credits',
        'max_seats',
        'notes',
        'set_by_user_id',
    ];

    protected $casts = [
        'override_price_credits'  => 'integer',
        'per_seat_price_credits'  => 'integer',
        'max_seats'               => 'integer',
    ];

    public function faction(): BelongsTo
    {
        return $this->belongsTo(Faction::class);
    }

    public function setBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'set_by_user_id');
    }
}
