<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberChangelogEntry extends Model
{
    use HasFactory;

    protected $table = 'member_changelog_entries';

    protected $fillable = [
        'version',
        'title',
        'details',
        'tools',
        'audiences',
        'sort_order',
        'released_at',
        'is_active',
    ];

    protected $casts = [
        'tools' => 'array',
        'audiences' => 'array',
        'sort_order' => 'integer',
        'released_at' => 'datetime',
        'is_active' => 'boolean',
    ];
}

