<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcItemType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_uid',
        'class_name',
        'description',
        'weight_tonnes',
        'volume_m3',
        'price_credits',
        'batch_quantity',
        'production_modifier',
        'recommended_workers',
        'materials',
        'images',
        'image_url',
        'icon_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'weight_tonnes' => 'decimal:2',
        'volume_m3' => 'decimal:2',
        'materials' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
