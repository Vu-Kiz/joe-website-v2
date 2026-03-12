<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PaymentTransfer extends Model
{
    protected $fillable = [
        'payer_subject_type',
        'payer_subject_id',
        'payer_label',
        'payee_subject_type',
        'payee_subject_id',
        'payee_swc_uid',
        'payee_handle',
        'payee_label',
        'total_amount',
        'reference',
        'communication',
        'payment_method',
        'status',
        'opened_at',
        'verified_at',
        'verified_event_id',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'verified_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    public function items(): BelongsToMany
    {
        return $this->belongsToMany(PaymentItem::class, 'payment_transfer_items')
            ->withTimestamps();
    }
}