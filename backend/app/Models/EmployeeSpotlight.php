<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeSpotlight extends Model
{
    protected $table = 'employee_spotlight';

    protected $fillable = [
        'name',
        'reason',
        'image_path',
        'image_url',
    ];
}