<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\SwcAuthController;

Route::get('/', fn () => view('welcome'));

Route::get('/oauth', [SwcAuthController::class, 'redirect']);
Route::get('/oauth/debug', [SwcAuthController::class, 'debugRedirect']);
Route::get('/oauth/callback', [SwcAuthController::class, 'callback']);

Route::get('/oauth/events', [SwcAuthController::class, 'eventsRedirect'])
    ->middleware('auth');
Route::get('/oauth/creditlog', [SwcAuthController::class, 'creditLogRedirect']);