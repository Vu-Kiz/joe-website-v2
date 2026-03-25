<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcShipType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'length',
        'max_speed',
        'hyperdrive',
        'max_passengers',
        'hull',
        'shield',
        'price_credits',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'length' => 'decimal:2',
        'hyperdrive' => 'decimal:2',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
