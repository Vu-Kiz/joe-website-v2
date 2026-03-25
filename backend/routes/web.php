<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\DiscordAuthController;
use App\Http\Controllers\Auth\SwcAuthController;

Route::get('/', fn () => view('welcome'));

Route::get('/auth/discord', [DiscordAuthController::class, 'redirect']);
Route::get('/auth/discord/callback', [DiscordAuthController::class, 'callback']);

Route::get('/oauth', [SwcAuthController::class, 'redirect']);
Route::get('/oauth/callback', [SwcAuthController::class, 'callback']);
Route::get('/oauth/creditlog', [SwcAuthController::class, 'creditLogRedirect']);
