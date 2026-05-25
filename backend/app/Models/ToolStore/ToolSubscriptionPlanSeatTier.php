<?php

namespace App\Models\ToolStore;

use Illuminate\Database\Eloquent\Model;

class ToolSubscriptionPlanSeatTier extends Model
{
    protected $fillable = [
        'plan_key',
        'min_seats',
        'price_per_seat_credits',
    ];

    protected $casts = [
        'min_seats'             => 'integer',
        'price_per_seat_credits'=> 'integer',
    ];

    /**
     * Given a plan key and seat count, return the best-matching tier or null.
     */
    public static function bestFor(string $planKey, int $seatCount): ?self
    {
        return self::query()
            ->where('plan_key', $planKey)
            ->where('min_seats', '<=', $seatCount)
            ->orderByDesc('min_seats')
            ->first();
    }
}
