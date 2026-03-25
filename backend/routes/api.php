<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\JobsController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\LoadingTipController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BlogController;
use App\Http\Controllers\Api\UniverseController;
use App\Http\Controllers\Api\Sys\SectorCellAnnotationController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\TimeController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\Sys\UniversePullController;
use App\Http\Controllers\Api\AdminLoadingTipController;
use App\Http\Controllers\Api\EmployeeSpotlightController;
use App\Http\Controllers\Api\AdminEmployeeSpotlightController;
use App\Http\Controllers\Api\TatooineWeatherController;
use App\Http\Controllers\Api\AdminWeatherController;
use App\Http\Controllers\Api\AdminActionLogController;
use App\Http\Controllers\Api\AdminSiteLockController;
use App\Http\Controllers\Api\AdminEntityStatsController;
use App\Http\Controllers\Api\SiteLockStatusController;
use App\Http\Controllers\Api\SwcAuthorizationController;
use App\Http\Controllers\Api\TenetOfSalvageController;
use App\Http\Controllers\Api\AdminTenetOfSalvageController;
use App\Http\Controllers\Api\SysadminDebugController;
use App\Http\Controllers\Api\FactionController;
use App\Http\Controllers\Api\FactionPrivilegeController;
use App\Http\Controllers\Api\ManualPaymentTemplateController;



// Public utility
Route::get('/health', [HealthController::class, 'index']);
Route::get('/meta', [MetaController::class, 'index']);
Route::get('/loading-tip', [LoadingTipController::class, 'index']);
Route::get('/time', [TimeController::class, 'show']);

// Auth
Route::prefix('auth')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// Blog (public read)
Route::get('/blog', [BlogController::class, 'index']);
Route::get('/blog/{id}', [BlogController::class, 'show']);

// Blog create/edit/upload: can_manage_blog OR is_admin OR sysadmin override
Route::middleware(['auth:sanctum', 'require_any:can_manage_blog,is_admin'])->group(function () {
    Route::post('/blog', [BlogController::class, 'store']);
    Route::put('/blog/{id}', [BlogController::class, 'update']);
    Route::post('/upload', [UploadController::class, 'store']);
});

// Blog delete: admin only (plus sysadmin override)
Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::delete('/blog/{id}', [BlogController::class, 'destroy']);
});

// Admin user permissions: admin only (plus sysadmin override)
Route::middleware(['auth:sanctum', 'require_any:is_admin'])->prefix('admin')->group(function () {
    Route::get('/users', [AdminUserController::class, 'index']);
    Route::patch('/users/{user}/permissions', [AdminUserController::class, 'updatePermissions']);
});

// Jobs
Route::prefix('jobs')->group(function () {
    Route::get('/', [JobsController::class, 'index']);
    Route::get('/{id}', [JobsController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/', [JobsController::class, 'store']);
        Route::put('/{id}', [JobsController::class, 'update']);
        Route::delete('/{id}', [JobsController::class, 'destroy']);
        Route::post('/{id}/take', [JobsController::class, 'take']);
        Route::post('/{id}/complete', [JobsController::class, 'complete']);
        Route::post('/{id}/close', [JobsController::class, 'close']);
        Route::post('/{id}/join', [JobsController::class, 'join']);
    });
});

Route::middleware('auth:sanctum')->prefix('job-assignments')->group(function () {
    Route::post('/{id}/complete', [JobsController::class, 'completeAssignment']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/payments', [\App\Http\Controllers\Api\PaymentController::class, 'index']);
    Route::get('/payments/owed-to-me', [\App\Http\Controllers\Api\PaymentController::class, 'owedToMe']);
    Route::get('/payment-transfers', [\App\Http\Controllers\Api\PaymentController::class, 'transfers']);
    Route::post('/payments/build-single', [\App\Http\Controllers\Api\PaymentController::class, 'buildSingle']);
    Route::post('/payments/build-bulk', [\App\Http\Controllers\Api\PaymentController::class, 'buildBulk']);
    Route::post('/payment-transfers/{paymentTransfer}/verify', [\App\Http\Controllers\Api\PaymentController::class, 'verify']);
    Route::get('/universe/sectors', [UniverseController::class, 'sectors']);
    Route::get('/universe/map-systems', [UniverseController::class, 'mapSystems']);
    Route::get('/universe/sectors/{sector}', [UniverseController::class, 'sector']);
    Route::get('/universe/systems/{system}', [UniverseController::class, 'system']);
    Route::get('/universe/cell-annotations', [SectorCellAnnotationController::class, 'index']);
    Route::post('/universe/cell-annotations', [SectorCellAnnotationController::class, 'upsert']);
    Route::get('/universe/station-types', [UniverseController::class, 'stationTypes']);
    Route::get('/universe/station-types/{stationType}', [UniverseController::class, 'stationType']);
    Route::get('/universe/facility-types', [UniverseController::class, 'facilityTypes']);
    Route::get('/universe/facility-types/{facilityType}', [UniverseController::class, 'facilityType']);
    Route::get('/universe/item-types', [UniverseController::class, 'itemTypes']);
    Route::get('/universe/item-types/{itemType}', [UniverseController::class, 'itemType']);
    Route::get('/universe/ship-types', [UniverseController::class, 'shipTypes']);
    Route::get('/universe/ship-types/{shipType}', [UniverseController::class, 'shipType']);
    Route::get('/universe/terrain-types', [UniverseController::class, 'terrainTypes']);
    Route::get('/universe/terrain-types/{terrainType}', [UniverseController::class, 'terrainType']);
    Route::get('/universe/material-types', [UniverseController::class, 'materialTypes']);
    Route::get('/universe/material-types/{materialType}', [UniverseController::class, 'materialType']);
});

// Sysadmin-only: heavy/system actions
Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('sys')->group(function () {
    Route::post('/universe/pull', [UniversePullController::class, 'run']);
    Route::post('/universe/pull-sector-stream', [UniversePullController::class, 'runSectorStream']);
    Route::post('/universe/pull-system-stream', [UniversePullController::class, 'runSystemStream']);
    Route::post('/universe/pull-all-sectors', [UniversePullController::class, 'runAllSectors']);
    Route::post('/universe/pull-all-station-types', [UniversePullController::class, 'runAllStationTypes']);
    Route::post('/universe/pull-all-station-types-stream', [UniversePullController::class, 'runAllStationTypesStream']);
    Route::post('/universe/pull-all-facility-types', [UniversePullController::class, 'runAllFacilityTypes']);
    Route::post('/universe/pull-all-facility-types-stream', [UniversePullController::class, 'runAllFacilityTypesStream']);
    Route::post('/universe/pull-all-item-types', [UniversePullController::class, 'runAllItemTypes']);
    Route::post('/universe/pull-all-item-types-stream', [UniversePullController::class, 'runAllItemTypesStream']);
    Route::post('/universe/pull-all-ship-types', [UniversePullController::class, 'runAllShipTypes']);
    Route::post('/universe/pull-all-ship-types-stream', [UniversePullController::class, 'runAllShipTypesStream']);
    Route::post('/universe/pull-all-terrain-types', [UniversePullController::class, 'runAllTerrainTypes']);
    Route::post('/universe/pull-all-terrain-types-stream', [UniversePullController::class, 'runAllTerrainTypesStream']);
    Route::post('/universe/pull-all-material-types', [UniversePullController::class, 'runAllMaterialTypes']);
    Route::post('/universe/pull-all-material-types-stream', [UniversePullController::class, 'runAllMaterialTypesStream']);
    Route::post('/universe/refresh-planets', [UniversePullController::class, 'refreshStoredPlanets']);
    Route::post('/universe/refresh-planets-stream', [UniversePullController::class, 'refreshStoredPlanetsStream']);
    Route::post('/universe/pull-all-sectors-stream', [UniversePullController::class, 'runAllSectorsStream']);
    Route::post('/universe/full-sync-runs', [UniversePullController::class, 'startFullSync']);
    Route::get('/universe/full-sync-runs/latest', [UniversePullController::class, 'latestFullSync']);
    Route::get('/universe/full-sync-runs/{run}', [UniversePullController::class, 'showFullSync']);
    Route::post('/universe/full-sync-runs/{run}/cancel', [UniversePullController::class, 'cancelFullSync']);
});

// Loading tip management: can_manage_tips OR is_admin OR sysadmin override
Route::middleware(['auth:sanctum', 'require_any:can_manage_tips,is_admin'])->group(function () {
    Route::get('/admin/loading-tips', [AdminLoadingTipController::class, 'index']);
    Route::post('/admin/loading-tips', [AdminLoadingTipController::class, 'store']);
    Route::put('/admin/loading-tips/{loadingTip}', [AdminLoadingTipController::class, 'update']);
    Route::delete('/admin/loading-tips/{loadingTip}', [AdminLoadingTipController::class, 'destroy']);
});

Route::get('/eotm/current', [EmployeeSpotlightController::class, 'current']);

Route::middleware(['auth:sanctum', 'require_any:can_manage_eotm,is_admin'])->group(function () {
    Route::get('/admin/eotm', [AdminEmployeeSpotlightController::class, 'index']);
    Route::post('/admin/eotm', [AdminEmployeeSpotlightController::class, 'store']);
    Route::put('/admin/eotm/{employeeSpotlight}', [AdminEmployeeSpotlightController::class, 'update']);
    Route::delete('/admin/eotm/{employeeSpotlight}', [AdminEmployeeSpotlightController::class, 'destroy']);
});

Route::get('/weather/tatooine', [TatooineWeatherController::class, 'show']);

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/weather', [AdminWeatherController::class, 'index']);
    Route::put('/admin/weather/settings', [AdminWeatherController::class, 'updateSettings']);

    Route::post('/admin/weather/adjectives', [AdminWeatherController::class, 'storeAdjective']);
    Route::put('/admin/weather/adjectives/{hotAdjective}', [AdminWeatherController::class, 'updateAdjective']);
    Route::delete('/admin/weather/adjectives/{hotAdjective}', [AdminWeatherController::class, 'destroyAdjective']);

    Route::post('/admin/weather/advice', [AdminWeatherController::class, 'storeAdvice']);
    Route::put('/admin/weather/advice/{weatherAdvice}', [AdminWeatherController::class, 'updateAdvice']);
    Route::delete('/admin/weather/advice/{weatherAdvice}', [AdminWeatherController::class, 'destroyAdvice']);
});

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/action-logs', [AdminActionLogController::class, 'index']);
});

Route::get('/site-lock-status', [SiteLockStatusController::class, 'show']);

Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('admin')->group(function () {
    Route::get('/site-lock', [AdminSiteLockController::class, 'show']);
    Route::post('/site-lock', [AdminSiteLockController::class, 'update']);
    Route::post('/entity-stats/station-icons/populate', [AdminEntityStatsController::class, 'populateStationIcons']);
    Route::post('/entity-stats/material-icons/populate', [AdminEntityStatsController::class, 'populateMaterialIcons']);
    Route::put('/entity-stats/{entityType}/{entityId}', [AdminEntityStatsController::class, 'update']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/swc/authorization', [SwcAuthorizationController::class, 'show']);
});

Route::get('/tenets-of-salvage', [TenetOfSalvageController::class, 'index']);

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'index']);
    Route::post('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'store']);
    Route::put('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'update']);
    Route::delete('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('sys/debug')->group(function () {
    Route::get('/swc-auth', [SysadminDebugController::class, 'swcAuth']);
    Route::get('/payments', [SysadminDebugController::class, 'payments']);
    Route::get('/factions', [SysadminDebugController::class, 'factions']);
    Route::get('/raw-swc', [SysadminDebugController::class, 'rawSwc']);
    Route::get('/test-faction-privilege', [SysadminDebugController::class, 'testFactionPrivilege']);
    Route::post('/test-payment', [SysadminDebugController::class, 'testPayment']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/factions/mine', [FactionController::class, 'mine']);
    Route::get('/factions/mine/payable', [FactionController::class, 'minePayable']);
    Route::get('/manual-payment-templates', [ManualPaymentTemplateController::class, 'index']);
    Route::post('/manual-payment-templates', [ManualPaymentTemplateController::class, 'store']);
    Route::put('/manual-payment-templates/{manualPaymentTemplate}', [ManualPaymentTemplateController::class, 'update']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/toggle', [ManualPaymentTemplateController::class, 'toggle']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/generate', [ManualPaymentTemplateController::class, 'generate']);
    Route::get('/factions/mine/privileges', [FactionPrivilegeController::class, 'mine']);
    
});
