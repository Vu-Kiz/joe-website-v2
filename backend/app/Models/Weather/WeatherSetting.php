<?php

namespace App\Models\Weather;

use Illuminate\Database\Eloquent\Model;

class WeatherSetting extends Model
{
    protected $table = 'weather_settings';

    public $timestamps = false;

    protected $fillable = [
        'min_temp',
        'max_temp',
        'created_at',
    ];

    protected $casts = [
        'min_temp' => 'integer',
        'max_temp' => 'integer',
        'created_at' => 'datetime',
    ];
}