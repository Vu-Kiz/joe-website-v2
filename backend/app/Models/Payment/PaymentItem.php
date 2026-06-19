<?php

namespace App\Models\Payment;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PaymentItem extends Model
{
    protected $fillable = [
        'tool_key',
        'source_type',
        'source_id',
        'pending_dedupe_id',
        'payer_subject_type',
        'payer_subject_id',
        'payer_label',
        'payee_subject_type',
        'payee_subject_id',
        'payee_swc_uid',
        'payee_handle',
        'payee_label',
        'amount',
        'bonus_amount',
        'total_amount',
        'status',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    public function transfers(): BelongsToMany
    {
        return $this->belongsToMany(PaymentTransfer::class, 'payment_transfer_items')
            ->withTimestamps();
    }

    protected static function booted(): void
    {
        // Only a still-pending row can occupy a (source_type, source_id) dedupe slot.
        // Once a row moves past pending (attached/paid/cancelled) it's historical and
        // must free the slot so the next reward/payment cycle can create a new row.
        static::saving(function (PaymentItem $item) {
            $item->pending_dedupe_id = $item->status === 'pending' ? $item->source_id : null;
        });
    }
}