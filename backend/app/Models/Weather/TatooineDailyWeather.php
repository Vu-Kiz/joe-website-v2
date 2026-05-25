<?php

namespace App\Models\Weather;

use Illuminate\Database\Eloquent\Model;

class TatooineDailyWeather extends Model
{
    protected $table = 'tatooine_daily_weather';

    public $timestamps = false;

    protected $fillable = [
        'weather_date',
        'temperature',
        'adjective',
        'advice',
        'message',
        'created_at',
    ];

    protected $casts = [
        'weather_date' => 'date',
        'temperature' => 'integer',
        'created_at' => 'datetime',
    ];
}