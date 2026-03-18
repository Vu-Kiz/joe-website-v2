<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManualPaymentTemplate extends Model
{
    protected $fillable = [
        'name',
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
        'frequency',
        'day_of_month',
        'start_date',
        'end_date',
        'communication_prefix',
        'notes',
        'status',
        'last_generated_period',
        'meta',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'day_of_month' => 'integer',
        'amount' => 'integer',
        'bonus_amount' => 'integer',
        'total_amount' => 'integer',
        'meta' => 'array',
    ];
}