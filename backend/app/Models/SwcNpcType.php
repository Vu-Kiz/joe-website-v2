<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcNpcType extends Model
{
    protected $fillable = [
        'uid',
        'name',
        'class_name',
        'description',
        'price_credits',
        'hiring_locations',
        'skills',
        'images',
        'image_url',
        'payload',
        'last_pulled_at',
    ];

    protected $casts = [
        'hiring_locations' => 'array',
        'skills' => 'array',
        'images' => 'array',
        'payload' => 'array',
        'last_pulled_at' => 'datetime',
    ];
}
