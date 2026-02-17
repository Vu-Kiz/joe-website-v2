<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory;
    use Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'swc_character_id',
        'swc_handle',
        'swc_avatar_url',
        'is_joe_member',
        'is_admin',
        'is_sysadmin',
        'is_intel',
        'is_garry',
        'is_raid',
    ];

    protected $casts = [
        'swc_character_id' => 'integer',
        'is_joe_member' => 'boolean',
        'is_admin' => 'boolean',
        'is_sysadmin' => 'boolean',
        'is_intel' => 'boolean',
        'is_garry' => 'boolean',
        'is_raid' => 'boolean',
    ];

    protected $hidden = [
        'remember_token',
    ];
}
