<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',

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

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',

        'is_joe_member' => 'bool',
        'is_admin'      => 'bool',
        'is_sysadmin'   => 'bool',
        'is_intel'      => 'bool',
        'is_garry'      => 'bool',
        'is_raid'       => 'bool',
    ];
}
