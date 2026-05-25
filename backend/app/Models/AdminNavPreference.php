<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminNavPreference extends Model
{
    protected $table = 'admin_nav_preferences';

    protected $fillable = [
        'user_id',
        'recents',
        'favorites',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'recents' => 'array',
        'favorites' => 'array',
    ];
}

