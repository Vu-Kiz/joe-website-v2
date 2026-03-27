<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\DiscordAuthController;
use App\Http\Controllers\Auth\SwcAuthController;

Route::get('/', function () {
    return response()
        ->view('welcome')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
});

Route::get('/auth/discord', [DiscordAuthController::class, 'redirect']);
Route::get('/auth/discord/callback', [DiscordAuthController::class, 'callback']);

Route::get('/oauth', [SwcAuthController::class, 'redirect']);
Route::get('/oauth/callback', [SwcAuthController::class, 'callback']);
Route::get('/oauth/member-tools', [SwcAuthController::class, 'memberToolsRedirect']);
Route::get('/oauth/creditlog', [SwcAuthController::class, 'creditLogRedirect']);
Route::get('/oauth/events', [SwcAuthController::class, 'eventsRedirect']);
Route::get('/oauth/debug', [SwcAuthController::class, 'debugRedirect']);
