<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcTerrainType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'code',
        'material_probability_percent',
        'material_types',
        'images',
        'description',
        'image_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'material_types' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
