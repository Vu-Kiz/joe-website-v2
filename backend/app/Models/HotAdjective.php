<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HotAdjective extends Model
{
    protected $table = 'hot_adjectives';

    public $timestamps = false;

    protected $fillable = [
        'word',
        'min_temp',
        'max_temp',
    ];

    protected $casts = [
        'min_temp' => 'integer',
        'max_temp' => 'integer',
    ];
}