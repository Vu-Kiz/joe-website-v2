<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcMaterialType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'description',
        'weight_tonnes',
        'volume_m3',
        'rarity',
        'price_credits',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'weight_tonnes' => 'decimal:2',
        'volume_m3' => 'decimal:2',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
