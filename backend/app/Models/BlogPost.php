<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BlogPost extends Model
{
    protected $table = 'blog_posts';

    public $timestamps = false; // because table uses created_at custom and optional updated_at

    protected $fillable = [
        'title',
        'body',
        'image_path',
        'image_url',
        'author_uid',
        'author_handle',
        'created_at',
        'updated_at',
        'cgt_created',
    ];
}
