<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcWeaponType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'damage_type',
        'min_damage',
        'max_damage',
        'optimum_range',
        'max_hits',
        'drop_off',
        'firepower',
        'tracking',
        'fire_delay',
        'is_poison',
        'is_dual',
        'price_credits',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'images' => 'array',
        'payload' => 'array',
        'is_poison' => 'boolean',
        'is_dual' => 'boolean',
        'last_pulled_at' => 'datetime',
    ];
}
