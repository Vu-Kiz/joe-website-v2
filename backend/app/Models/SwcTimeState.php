<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwcTimeState extends Model
{
    protected $table = 'swc_time_state';

    protected $fillable = [
        'year', 'day', 'hours', 'mins', 'secs',
        'swc_seconds', 'refreshed_at',
    ];

    protected $casts = [
        'refreshed_at' => 'datetime',
    ];
}