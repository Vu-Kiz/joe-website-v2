<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\JobsController;
use App\Http\Controllers\Api\LoadingTipController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. They are prefixed with /api.
|
*/

Route::get('/health', [HealthController::class, 'index']);

Route::prefix('auth')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::get('/meta', [MetaController::class, 'index']);

Route::prefix('jobs')->group(function () {
    Route::get('/', [JobsController::class, 'index']);
    Route::get('/{id}', [JobsController::class, 'show']);
    Route::post('/', [JobsController::class, 'store']);
    Route::put('/{id}', [JobsController::class, 'update']);
    Route::delete('/{id}', [JobsController::class, 'destroy']);
});
Route::get('/loading-tip', [LoadingTipController::class, 'index']);