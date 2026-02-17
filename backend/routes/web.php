<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\SwcAuthController;
use App\Http\Controllers\Api\AuthController;

Route::get('/', fn () => view('welcome'));

// OAuth entrypoints (session-based)
Route::get('/oauth', [SwcAuthController::class, 'redirect']);
Route::get('/oauth/callback', [SwcAuthController::class, 'callback']);

// Session-backed endpoints used by the SPA
Route::prefix('api')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});
