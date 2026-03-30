<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcVehicleType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'length',
        'manoeuvrability',
        'sensors',
        'ecm',
        'weight_tonnes',
        'volume_m3',
        'weight_capacity_tonnes',
        'volume_capacity_m3',
        'max_speed',
        'max_passengers',
        'hull',
        'shield',
        'ionic_capacity',
        'has_repulsors',
        'slot_size',
        'medical_rooms',
        'has_hangar_bay',
        'has_docking_bay',
        'can_recycle',
        'production_modifier',
        'recommended_workers',
        'recycling_xp',
        'generic_slots',
        'terrain_restrictions',
        'weapons',
        'materials',
        'price_credits',
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
        'has_repulsors' => 'boolean',
        'slot_size' => 'decimal:2',
        'has_hangar_bay' => 'boolean',
        'has_docking_bay' => 'boolean',
        'can_recycle' => 'boolean',
        'terrain_restrictions' => 'array',
        'weapons' => 'array',
        'materials' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
