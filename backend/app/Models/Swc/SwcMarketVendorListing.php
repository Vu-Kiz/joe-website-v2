<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcMarketVendorListing extends Model
{
    protected $fillable = [
        'vendor_id',
        'ware_name',
        'matched_item_type_uid',
        'matched_entity_type',
        'quantity',
        'price',
        'currency',
        'image_small',
        'image_large',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price' => 'integer',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(SwcMarketVendor::class, 'vendor_id');
    }
}
