<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcDroidType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'sensors',
        'ecm',
        'batch_quantity',
        'weight_tonnes',
        'volume_m3',
        'weight_capacity_tonnes',
        'volume_capacity_m3',
        'hull',
        'shield',
        'ionic_capacity',
        'armour',
        'slot_size',
        'terrain_restrictions',
        'price_credits',
        'production_modifier',
        'recommended_workers',
        'recycling_xp',
        'generic_slots',
        'skills',
        'weapons',
        'materials',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'terrain_restrictions' => 'array',
        'skills' => 'array',
        'weapons' => 'array',
        'materials' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
