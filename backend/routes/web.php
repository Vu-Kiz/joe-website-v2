<?php

use App\Http\Controllers\Auth\SwcAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome'); // or whatever
});

// SWC OAuth
Route::get('/oauth', [SwcAuthController::class, 'redirect'])->name('swc.oauth.redirect');
Route::get('/oauth/callback', [SwcAuthController::class, 'callback'])->name('swc.oauth.callback');
