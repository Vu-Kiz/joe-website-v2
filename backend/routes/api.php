<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\JobsController;
use App\Http\Controllers\Api\LoadingTipController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BlogController;
use App\Http\Controllers\Api\UploadController;

Route::get('/health', [HealthController::class, 'index']);
Route::get('/meta', [MetaController::class, 'index']);
Route::get('/loading-tip', [LoadingTipController::class, 'index']);

Route::prefix('blog')->group(function () {
    Route::get('/', [BlogController::class, 'index']);
    Route::get('/{id}', [BlogController::class, 'show']);
    Route::post('/', [BlogController::class, 'store']);
    Route::put('/{id}', [BlogController::class, 'update']);
    Route::delete('/{id}', [BlogController::class, 'destroy']);
});

Route::post('/upload', [UploadController::class, 'store']);

Route::prefix('jobs')->group(function () {
    Route::get('/', [JobsController::class, 'index']);
    Route::get('/{id}', [JobsController::class, 'show']);
    Route::post('/', [JobsController::class, 'store']);
    Route::put('/{id}', [JobsController::class, 'update']);
    Route::delete('/{id}', [JobsController::class, 'destroy']);
});

Route::prefix('auth')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
