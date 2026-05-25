<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;

class SwcPlanetType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'description',
        'images',
        'image_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
