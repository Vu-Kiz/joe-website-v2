<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenetOfSalvage extends Model
{
    protected $table = 'tenets_of_salvage';

    protected $fillable = [
        'title',
        'body_bbcode',
        'weight',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'weight'    => 'integer',
    ];
}