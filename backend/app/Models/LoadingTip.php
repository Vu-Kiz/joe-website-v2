<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoadingTip extends Model
{
    protected $table = 'loading_tips';

    // Table has only created_at, no updated_at, and we don't need Eloquent timestamps here.
    public $timestamps = false;

    protected $fillable = [
        'tip',
        'created_at',
    ];
}
