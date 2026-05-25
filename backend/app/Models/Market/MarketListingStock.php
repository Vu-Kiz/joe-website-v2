<?php

declare(strict_types=1);

namespace App\Models\Market;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketListingStock extends Model
{
    protected $table = 'market_listing_stock';

    protected $fillable = [
        'listing_id',
        'entity_uid',
        'entity_type',
        'status',
        'order_id',
        'sold_at',
    ];

    protected $casts = [
        'sold_at' => 'datetime',
    ];

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_RESERVED  = 'reserved';
    public const STATUS_SOLD      = 'sold';

    public function listing(): BelongsTo
    {
        return $this->belongsTo(MarketListing::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(MarketOrder::class);
    }
}
