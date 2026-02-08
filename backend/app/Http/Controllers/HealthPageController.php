<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Api\HealthController;

class HealthPageController extends Controller
{
    public function index()
    {
        return view('health', [
            'health' => HealthController::payload(),
        ]);
    }
}
