<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcShipType extends Model
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
        'hyperdrive',
        'max_passengers',
        'escape_pods',
        'hull',
        'shield',
        'shield_arcs',
        'armour',
        'ionic_capacity',
        'has_repulsors',
        'slot_size',
        'medical_rooms',
        'has_hangar_bay',
        'has_docking_bay',
        'can_recycle',
        'can_interdict',
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
        'hyperdrive' => 'decimal:2',
        'weight_tonnes' => 'float',
        'volume_m3' => 'float',
        'weight_capacity_tonnes' => 'float',
        'volume_capacity_m3' => 'float',
        'has_repulsors' => 'boolean',
        'has_hangar_bay' => 'boolean',
        'has_docking_bay' => 'boolean',
        'can_recycle' => 'boolean',
        'can_interdict' => 'boolean',
        'shield_arcs' => 'array',
        'weapons' => 'array',
        'materials' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
