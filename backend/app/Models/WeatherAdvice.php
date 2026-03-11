<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeatherAdvice extends Model
{
    protected $table = 'weather_advice';

    public $timestamps = false;

    protected $fillable = [
        'advice',
        'weight',
        'is_active',
        'created_at',
    ];

    protected $casts = [
        'weight' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
    ];
}