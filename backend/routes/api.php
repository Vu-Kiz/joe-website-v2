<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\JobsController;

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

Route::get('/meta', [MetaController::class, 'index']);

Route::prefix('jobs')->group(function () {
    Route::get('/', [JobsController::class, 'index']);
    Route::get('/{id}', [JobsController::class, 'show']);
    Route::post('/', [JobsController::class, 'store']);
    Route::put('/{id}', [JobsController::class, 'update']);
    Route::delete('/{id}', [JobsController::class, 'destroy']);
});
