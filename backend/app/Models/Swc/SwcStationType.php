<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SwcStationType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'length',
        'description',
        'sensors',
        'ecm',
        'weight_tonnes',
        'volume_m3',
        'weight_capacity_tonnes',
        'volume_capacity_m3',
        'max_passengers',
        'escape_pods',
        'hull',
        'shield',
        'ionic_capacity',
        'medical_rooms',
        'has_hangar_bay',
        'has_docking_bay',
        'can_recycle',
        'can_produce',
        'is_asteroid_mining_depot',
        'can_refine_alazhi',
        'can_interdict',
        'can_research',
        'price_credits',
        'production_modifier',
        'recommended_workers',
        'recycling_xp',
        'generic_slots',
        'weapons',
        'materials',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'length' => 'decimal:2',
        'weight_tonnes' => 'decimal:2',
        'volume_m3' => 'decimal:2',
        'weight_capacity_tonnes' => 'decimal:2',
        'volume_capacity_m3' => 'decimal:2',
        'has_hangar_bay' => 'boolean',
        'has_docking_bay' => 'boolean',
        'can_recycle' => 'boolean',
        'can_produce' => 'boolean',
        'is_asteroid_mining_depot' => 'boolean',
        'can_refine_alazhi' => 'boolean',
        'can_interdict' => 'boolean',
        'can_research' => 'boolean',
        'weapons' => 'array',
        'materials' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];

    public function stations(): HasMany
    {
        return $this->hasMany(SwcStation::class, 'station_type_id');
    }
}
