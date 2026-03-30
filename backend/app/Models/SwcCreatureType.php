<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcCreatureType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'slot_size',
        'species',
        'base_hp',
        'weight_tonnes',
        'volume_m3',
        'homeworld_uid',
        'homeworld_name',
        'homeworld_href',
        'spawn_terrain_types',
        'terrain_restrictions',
        'skills',
        'price_credits',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'slot_size' => 'float',
        'base_hp' => 'integer',
        'weight_tonnes' => 'float',
        'volume_m3' => 'float',
        'spawn_terrain_types' => 'array',
        'terrain_restrictions' => 'array',
        'skills' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
