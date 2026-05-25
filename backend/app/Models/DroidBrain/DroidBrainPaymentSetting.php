<?php

namespace App\Models\DroidBrain;

use Illuminate\Database\Eloquent\Model;

class DroidBrainPaymentSetting extends Model
{
    protected $table = 'droidbrain_payment_settings';

    protected $fillable = [
        'default_payer_faction_id',
    ];

    protected $casts = [
        'default_payer_faction_id' => 'integer',
    ];
}
