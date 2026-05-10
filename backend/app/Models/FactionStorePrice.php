<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FactionStorePrice extends Model
{
    protected $fillable = [
        'entity_uid',
        'entity_type',
        'label',
        'price_per_unit',
        'set_by_user_id',
    ];

    protected $casts = [
        'price_per_unit' => 'integer',
    ];

    public function setBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'set_by_user_id');
    }
}
