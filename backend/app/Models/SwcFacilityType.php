<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcFacilityType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'size',
        'length',
        'width',
        'height',
        'description',
        'price_credits',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'length' => 'decimal:2',
        'width' => 'decimal:2',
        'height' => 'decimal:2',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
