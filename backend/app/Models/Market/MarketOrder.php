<?php

namespace App\Models\Market;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketOrder extends Model
{
    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_PAID = 'paid';
    public const STATUS_TRANSFER_PENDING = 'transfer_pending';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_DISPUTED = 'disputed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'listing_id',
        'buyer_user_id',
        'quantity',
        'total_credits',
        'payment_transfer_id',
        'swc_transfer_result',
        'status',
        'dispute_note',
        'expires_at',
        'completed_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'total_credits' => 'integer',
        'expires_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(MarketListing::class, 'listing_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_user_id');
    }

    public function paymentTransfer(): BelongsTo
    {
        return $this->belongsTo(PaymentTransfer::class, 'payment_transfer_id');
    }

    public function isExpired(): bool
    {
        return $this->status === self::STATUS_PENDING_PAYMENT
            && $this->expires_at !== null
            && $this->expires_at->isPast();
    }

    public function getOrderReferenceAttribute(): string
    {
        return 'JOE-ORDER-' . $this->id;
    }
}
