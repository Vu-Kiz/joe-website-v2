<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcRace extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'description',
        'force_probability',
        'hp_bonus',
        'hp_multiplier',
        'homeworld_uid',
        'homeworld_name',
        'homeworld_href',
        'skills',
        'terrain_restrictions',
        'images',
        'image_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'skills' => 'array',
        'terrain_restrictions' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'hp_multiplier' => 'float',
        'last_pulled_at' => 'datetime',
    ];
}
