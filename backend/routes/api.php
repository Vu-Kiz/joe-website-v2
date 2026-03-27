<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\JobsController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\LoadingTipController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BlogController;
use App\Http\Controllers\Api\Universe\UniverseController;
use App\Http\Controllers\Api\Universe\CellAnnotationController;
use App\Http\Controllers\Api\Universe\SearchRecordController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\TimeController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\Universe\PullController;
use App\Http\Controllers\Api\Admin\LoadingTipController as AdminLoadingTipController;
use App\Http\Controllers\Api\EmployeeSpotlightController;
use App\Http\Controllers\Api\Admin\EmployeeSpotlightController as AdminEmployeeSpotlightController;
use App\Http\Controllers\Api\TatooineWeatherController;
use App\Http\Controllers\Api\Admin\WeatherController;
use App\Http\Controllers\Api\Admin\ActionLogController;
use App\Http\Controllers\Api\Admin\MemberAccessLogController;
use App\Http\Controllers\Api\Admin\SiteLockController;
use App\Http\Controllers\Api\Admin\EntityStatsController;
use App\Http\Controllers\Api\SiteLockStatusController;
use App\Http\Controllers\Api\SwcAuthorizationController;
use App\Http\Controllers\Api\TenetOfSalvageController;
use App\Http\Controllers\Api\Admin\TenetOfSalvageController as AdminTenetOfSalvageController;
use App\Http\Controllers\Api\Admin\DebugController;
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
    Route::get('/users', [UserController::class, 'index']);
    Route::patch('/users/{user}/permissions', [UserController::class, 'updatePermissions']);
});

// Jobs
Route::prefix('jobs')->group(function () {
    Route::get('/', [JobsController::class, 'index']);
    Route::get('/{id}', [JobsController::class, 'show']);

    Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
        Route::post('/', [JobsController::class, 'store']);
        Route::put('/{id}', [JobsController::class, 'update']);
        Route::delete('/{id}', [JobsController::class, 'destroy']);
        Route::post('/{id}/take', [JobsController::class, 'take']);
        Route::post('/{id}/complete', [JobsController::class, 'complete']);
        Route::post('/{id}/close', [JobsController::class, 'close']);
        Route::post('/{id}/join', [JobsController::class, 'join']);
    });
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->prefix('job-assignments')->group(function () {
    Route::post('/{id}/complete', [JobsController::class, 'completeAssignment']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    Route::get('/payments', [\App\Http\Controllers\Api\PaymentController::class, 'index']);
    Route::get('/payments/owed-to-me', [\App\Http\Controllers\Api\PaymentController::class, 'owedToMe']);
    Route::get('/payment-transfers', [\App\Http\Controllers\Api\PaymentController::class, 'transfers']);
    Route::post('/payments/build-single', [\App\Http\Controllers\Api\PaymentController::class, 'buildSingle']);
    Route::post('/payments/build-bulk', [\App\Http\Controllers\Api\PaymentController::class, 'buildBulk']);
    Route::post('/payment-transfers/{paymentTransfer}/verify', [\App\Http\Controllers\Api\PaymentController::class, 'verify']);
    Route::get('/universe/sectors', [UniverseController::class, 'sectors']);
    Route::get('/universe/map-systems', [UniverseController::class, 'mapSystems']);
    Route::get('/universe/search-records', [UniverseController::class, 'searchRecords']);
    Route::get('/universe/sectors/{sector}', [UniverseController::class, 'sector']);
    Route::get('/universe/systems/{system}', [UniverseController::class, 'system']);
    Route::get('/universe/cell-annotations', [CellAnnotationController::class, 'index']);
    Route::post('/universe/cell-annotations', [CellAnnotationController::class, 'upsert']);
    Route::get('/universe/station-types', [UniverseController::class, 'stationTypes']);
    Route::get('/universe/station-types/{stationType}', [UniverseController::class, 'stationType']);
    Route::get('/universe/facility-types', [UniverseController::class, 'facilityTypes']);
    Route::get('/universe/facility-types/{facilityType}', [UniverseController::class, 'facilityType']);
    Route::get('/universe/item-types', [UniverseController::class, 'itemTypes']);
    Route::get('/universe/item-types/{itemType}', [UniverseController::class, 'itemType']);
    Route::get('/universe/planet-types', [UniverseController::class, 'planetTypes']);
    Route::get('/universe/planet-types/{planetType}', [UniverseController::class, 'planetType']);
    Route::get('/universe/ship-types', [UniverseController::class, 'shipTypes']);
    Route::get('/universe/ship-types/{shipType}', [UniverseController::class, 'shipType']);
    Route::get('/universe/terrain-types', [UniverseController::class, 'terrainTypes']);
    Route::get('/universe/terrain-types/{terrainType}', [UniverseController::class, 'terrainType']);
    Route::get('/universe/material-types', [UniverseController::class, 'materialTypes']);
    Route::get('/universe/material-types/{materialType}', [UniverseController::class, 'materialType']);
});

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::post('/universe/search-records', [SearchRecordController::class, 'upsert']);
});

// Sysadmin-only: heavy/system actions
Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('sys')->group(function () {
    Route::post('/universe/pull', [PullController::class, 'run']);
    Route::post('/universe/pull-sector-stream', [PullController::class, 'runSectorStream']);
    Route::post('/universe/pull-system-stream', [PullController::class, 'runSystemStream']);
    Route::post('/universe/pull-all-sectors', [PullController::class, 'runAllSectors']);
    Route::post('/universe/pull-all-station-types', [PullController::class, 'runAllStationTypes']);
    Route::post('/universe/pull-all-station-types-stream', [PullController::class, 'runAllStationTypesStream']);
    Route::post('/universe/pull-all-planet-types', [PullController::class, 'runAllPlanetTypes']);
    Route::post('/universe/pull-all-planet-types-stream', [PullController::class, 'runAllPlanetTypesStream']);
    Route::post('/universe/pull-all-facility-types', [PullController::class, 'runAllFacilityTypes']);
    Route::post('/universe/pull-all-facility-types-stream', [PullController::class, 'runAllFacilityTypesStream']);
    Route::post('/universe/pull-all-item-types', [PullController::class, 'runAllItemTypes']);
    Route::post('/universe/pull-all-item-types-stream', [PullController::class, 'runAllItemTypesStream']);
    Route::post('/universe/pull-all-ship-types', [PullController::class, 'runAllShipTypes']);
    Route::post('/universe/pull-all-ship-types-stream', [PullController::class, 'runAllShipTypesStream']);
    Route::post('/universe/pull-all-terrain-types', [PullController::class, 'runAllTerrainTypes']);
    Route::post('/universe/pull-all-terrain-types-stream', [PullController::class, 'runAllTerrainTypesStream']);
    Route::post('/universe/pull-all-material-types', [PullController::class, 'runAllMaterialTypes']);
    Route::post('/universe/pull-all-material-types-stream', [PullController::class, 'runAllMaterialTypesStream']);
    Route::post('/universe/refresh-planets', [PullController::class, 'refreshStoredPlanets']);
    Route::post('/universe/refresh-planets-stream', [PullController::class, 'refreshStoredPlanetsStream']);
    Route::post('/universe/refresh-systems', [PullController::class, 'refreshStoredSystems']);
    Route::post('/universe/refresh-systems-stream', [PullController::class, 'refreshStoredSystemsStream']);
    Route::post('/universe/system-refresh-runs', [PullController::class, 'startStoredSystemsRefresh']);
    Route::get('/universe/system-refresh-runs/latest', [PullController::class, 'latestStoredSystemsRefresh']);
    Route::get('/universe/system-refresh-runs/{run}', [PullController::class, 'showStoredSystemsRefresh']);
    Route::post('/universe/system-refresh-runs/{run}/cancel', [PullController::class, 'cancelStoredSystemsRefresh']);
    Route::post('/universe/pull-all-sectors-stream', [PullController::class, 'runAllSectorsStream']);
    Route::post('/universe/full-sync-runs', [PullController::class, 'startFullSync']);
    Route::get('/universe/full-sync-runs/latest', [PullController::class, 'latestFullSync']);
    Route::get('/universe/full-sync-runs/{run}', [PullController::class, 'showFullSync']);
    Route::post('/universe/full-sync-runs/{run}/cancel', [PullController::class, 'cancelFullSync']);
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
    Route::get('/admin/weather', [WeatherController::class, 'index']);
    Route::put('/admin/weather/settings', [WeatherController::class, 'updateSettings']);

    Route::post('/admin/weather/adjectives', [WeatherController::class, 'storeAdjective']);
    Route::put('/admin/weather/adjectives/{hotAdjective}', [WeatherController::class, 'updateAdjective']);
    Route::delete('/admin/weather/adjectives/{hotAdjective}', [WeatherController::class, 'destroyAdjective']);

    Route::post('/admin/weather/advice', [WeatherController::class, 'storeAdvice']);
    Route::put('/admin/weather/advice/{weatherAdvice}', [WeatherController::class, 'updateAdvice']);
    Route::delete('/admin/weather/advice/{weatherAdvice}', [WeatherController::class, 'destroyAdvice']);
});

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/action-logs', [ActionLogController::class, 'index']);
});

Route::get('/site-lock-status', [SiteLockStatusController::class, 'show']);

Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('admin')->group(function () {
    Route::get('/member-access-logs', [MemberAccessLogController::class, 'index']);
    Route::get('/site-lock', [SiteLockController::class, 'show']);
    Route::post('/site-lock', [SiteLockController::class, 'update']);
    Route::post('/entity-stats/station-icons/populate', [EntityStatsController::class, 'populateStationIcons']);
    Route::post('/entity-stats/material-icons/populate', [EntityStatsController::class, 'populateMaterialIcons']);
    Route::put('/entity-stats/{entityType}/{entityId}', [EntityStatsController::class, 'update']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    Route::get('/swc/authorization', [SwcAuthorizationController::class, 'show']);
    Route::put('/swc/authorization/preferences', [SwcAuthorizationController::class, 'updatePreferences']);
});

Route::get('/tenets-of-salvage', [TenetOfSalvageController::class, 'index']);

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'index']);
    Route::post('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'store']);
    Route::put('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'update']);
    Route::delete('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('sys/debug')->group(function () {
    Route::get('/swc-auth', [DebugController::class, 'swcAuth']);
    Route::get('/payments', [DebugController::class, 'payments']);
    Route::get('/factions', [DebugController::class, 'factions']);
    Route::get('/raw-swc', [DebugController::class, 'rawSwc']);
    Route::get('/events-history', [DebugController::class, 'eventsHistory']);
    Route::post('/events-history/import', [DebugController::class, 'importEventsHistory']);
    Route::get('/test-faction-privilege', [DebugController::class, 'testFactionPrivilege']);
    Route::post('/test-payment', [DebugController::class, 'testPayment']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    Route::get('/factions/mine', [FactionController::class, 'mine']);
    Route::get('/factions/mine/payable', [FactionController::class, 'minePayable']);
    Route::post('/universe/search-records/import-personal-events', [SearchRecordController::class, 'importPersonalEvents']);
    Route::get('/manual-payment-templates', [ManualPaymentTemplateController::class, 'index']);
    Route::post('/manual-payment-templates', [ManualPaymentTemplateController::class, 'store']);
    Route::put('/manual-payment-templates/{manualPaymentTemplate}', [ManualPaymentTemplateController::class, 'update']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/toggle', [ManualPaymentTemplateController::class, 'toggle']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/generate', [ManualPaymentTemplateController::class, 'generate']);
    Route::get('/factions/mine/privileges', [FactionPrivilegeController::class, 'mine']);
    
});
