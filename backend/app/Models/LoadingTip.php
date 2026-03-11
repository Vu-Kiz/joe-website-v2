<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoadingTip extends Model
{
    protected $table = 'loading_tips';

    public $timestamps = false;

    protected $fillable = [
        'tip',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}