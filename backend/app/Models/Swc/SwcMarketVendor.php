<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SwcMarketVendor extends Model
{
    protected $fillable = [
        'swc_vendor_id',
        'name',
        'description',
        'owner_uid',
        'owner_label',
        'shopkeeper_uid',
        'shopkeeper_name',
        'sector_uid',
        'sector_label',
        'system_uid',
        'system_label',
        'container_uid',
        'container_type',
        'container_label',
        'planet_uid',
        'planet_label',
        'city_uid',
        'city_label',
        'galx',
        'galy',
        'system_x',
        'system_y',
        'surface_x',
        'surface_y',
        'ground_x',
        'ground_y',
        'last_synced_at',
    ];

    protected $casts = [
        'galx' => 'integer',
        'galy' => 'integer',
        'system_x' => 'integer',
        'system_y' => 'integer',
        'surface_x' => 'integer',
        'surface_y' => 'integer',
        'ground_x' => 'integer',
        'ground_y' => 'integer',
        'last_synced_at' => 'datetime',
    ];

    public function listings(): HasMany
    {
        return $this->hasMany(SwcMarketVendorListing::class, 'vendor_id');
    }
}
