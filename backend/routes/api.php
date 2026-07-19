<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\Market\FactionStoreController;
use App\Http\Controllers\Api\Market\MarketCustomImageController;
use App\Http\Controllers\Api\Market\MarketEntityTypeSearchController;
use App\Http\Controllers\Api\Market\MarketInventoryController;
use App\Http\Controllers\Api\Market\MarketListingController;
use App\Http\Controllers\Api\Market\MarketOrderController;
use App\Http\Controllers\Api\Job\JobsController;
use App\Http\Controllers\Api\Job\JobPayRateController;
use App\Http\Controllers\Api\Job\JobPayClaimController;
use App\Http\Controllers\Api\Payment\PaymentController;
use App\Http\Controllers\Api\LoadingTipController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Blog\BlogController;
use App\Http\Controllers\Api\Universe\UniverseController;
use App\Http\Controllers\Api\Universe\CellAnnotationController;
use App\Http\Controllers\Api\Universe\SearchRecordController;
use App\Http\Controllers\Api\Universe\SubscriberCellRecordController;
use App\Http\Controllers\Api\Universe\UniverseEntityStatsController;
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
use App\Http\Controllers\Api\Admin\AstrogationUploadLogController;
use App\Http\Controllers\Api\Admin\MemberAccessLogController;
use App\Http\Controllers\Api\Admin\MemberChangelogAdminController;
use App\Http\Controllers\Api\Admin\AdminNavPreferenceController;
use App\Http\Controllers\Api\Admin\SiteLockController;
use App\Http\Controllers\Api\Admin\EntityStatsController;
use App\Http\Controllers\Api\Admin\DiscordBotAdminController;
use App\Http\Controllers\Api\Admin\WebsiteHealthController;
use App\Http\Controllers\Api\Admin\WorkerHealthController;
use App\Http\Controllers\Api\Admin\DroidBrainUploadAuditController;
use App\Http\Controllers\Api\Admin\ToolStoreAdminController;
use App\Http\Controllers\Api\SiteLockStatusController;
use App\Http\Controllers\Api\Member\SwcAuthorizationController;
use App\Http\Controllers\Api\Member\CharacterLocationController;
use App\Http\Controllers\Api\TenetOfSalvageController;
use App\Http\Controllers\Api\Admin\TenetOfSalvageController as AdminTenetOfSalvageController;
use App\Http\Controllers\Api\Admin\DebugController;
use App\Http\Controllers\Api\Faction\FactionController;
use App\Http\Controllers\Api\Faction\FactionPrivilegeController;
use App\Http\Controllers\Api\Payment\ManualPaymentTemplateController;
use App\Http\Controllers\Api\DroidBrainController;
use App\Http\Controllers\Api\Discord\DiscordBotController;
use App\Http\Controllers\Api\Member\MemberToolAccessController;
use App\Http\Controllers\Api\Member\MemberChangelogController;
use App\Http\Controllers\Api\ContactRequestController;
use App\Http\Controllers\Api\Admin\ContactRequestSettingsController;
use App\Http\Controllers\Api\Extension\HelperAuthController;
use App\Http\Controllers\Api\Extension\HelperSettingsController;
use App\Http\Controllers\Api\Member\RmBrowserController;
use App\Http\Controllers\Api\Member\SkillsToolController;
use App\Http\Controllers\Api\Member\FireDelayController;
use App\Http\Controllers\Api\Member\MarketVendorController;
use App\Http\Controllers\Api\Member\BountyHuntingController;
use App\Http\Controllers\Api\Member\XpTrackerController;
use App\Http\Controllers\Api\ToolStoreController;
use App\Http\Controllers\Api\Faction\FactionConsoleController;
use App\Http\Controllers\Api\Support\SupportTicketController;
use App\Http\Controllers\Api\Admin\SupportTicketAdminController;
use App\Http\Controllers\Api\Admin\MaterialPriceController;
use App\Http\Controllers\Api\Admin\MarketVendorAdminController;
use App\Http\Controllers\Api\Swc\SwcStatusController;
use App\Http\Controllers\Api\Sys\KanbanController;
use App\Http\Controllers\Api\Webhook\GlitchTipWebhookController;
use App\Http\Controllers\Api\TosController;
use App\Http\Controllers\Api\Admin\AdminTosController;

// TOS — current version is public; acceptance requires auth
Route::get('/tos/current', [TosController::class, 'current']);
Route::middleware(['auth:sanctum'])->post('/auth/accept-tos', [TosController::class, 'accept']);

// SWC status (public — no auth)
Route::get('/swc-status', [SwcStatusController::class, 'status']);
Route::post('/webhooks/uptime-kuma', [SwcStatusController::class, 'webhook'])->middleware('throttle:60,1');
Route::post('/webhooks/glitchtip', [GlitchTipWebhookController::class, 'handle'])->middleware('throttle:30,1');

// Tools store (catalog is public; subscribe requires auth)
Route::get('/tools/store/catalog', [ToolStoreController::class, 'catalog']);
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/tools/store/my-subscription', [ToolStoreController::class, 'mySubscription']);
    Route::post('/tools/store/subscribe/quote', [ToolStoreController::class, 'subscribeQuote']);
    Route::post('/tools/store/subscribe/send', [ToolStoreController::class, 'subscribeSend'])->middleware('throttle:10,1');

    // Factions — accessible to all authenticated users (needed for tool store faction subscription)
    Route::get('/factions/mine', [FactionController::class, 'mine']);

    // Faction console — managed by whoever activated the faction subscription
    Route::get('/faction-console', [FactionConsoleController::class, 'index']);
    Route::get('/faction-console/{subscriptionId}', [FactionConsoleController::class, 'show']);
    Route::post('/faction-console/{subscriptionId}/members/{userId}', [FactionConsoleController::class, 'grant']);
    Route::delete('/faction-console/{subscriptionId}/members/{userId}', [FactionConsoleController::class, 'revoke']);

    // Support tickets — JOE members + active subscribers only (gated in controller)
    Route::get('/support-tickets', [SupportTicketController::class, 'index']);
    Route::post('/support-tickets', [SupportTicketController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/support-tickets/{supportTicket}', [SupportTicketController::class, 'show']);
    Route::post('/support-tickets/{supportTicket}/reply', [SupportTicketController::class, 'reply'])->middleware('throttle:20,1');
});

// Public utility
Route::get('/loading-tip', [LoadingTipController::class, 'index']);
Route::get('/time', [TimeController::class, 'show']);
Route::post('/contact-requests', [ContactRequestController::class, 'store'])->middleware('throttle:5,1');

// Auth
Route::prefix('auth')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::middleware(['auth:sanctum'])->get('/session-stream', [AuthController::class, 'sessionStream']);
});

Route::prefix('discord-bot')->middleware(['discord_bot'])->group(function () {
    Route::post('/channels/{notificationKey}', [DiscordBotController::class, 'setChannel']);
    Route::post('/sync-state', [DiscordBotController::class, 'syncState']);
    Route::get('/changelog/latest-version', [DiscordBotController::class, 'latestChangelogVersion']);
    Route::post('/changelog/authorize-post', [DiscordBotController::class, 'authorizeChangelogPost']);
    Route::get('/outbox/claim', [DiscordBotController::class, 'claimOutbox']);
    Route::get('/outbox/claim-direct', [DiscordBotController::class, 'claimDirectOutbox']);
    Route::post('/outbox/{messageId}/delivered', [DiscordBotController::class, 'markDelivered']);
    Route::post('/outbox/{messageId}/failed', [DiscordBotController::class, 'markFailed']);
    Route::post('/jobs', [DiscordBotController::class, 'createJob']);
    Route::post('/jen', [DiscordBotController::class, 'createJen']);
    Route::post('/market/orders/{orderId}/fulfill', [DiscordBotController::class, 'fulfillMarketOrder']);
});

// Blog (public read)
Route::get('/blog', [BlogController::class, 'index']);
Route::get('/blog/{id}', [BlogController::class, 'show']);

// Blog create/edit/upload: can_manage_blog OR is_admin OR sysadmin override
Route::middleware(['auth:sanctum', 'require_any:can_manage_blog,is_admin'])->group(function () {
    Route::post('/blog', [BlogController::class, 'store']);
    Route::put('/blog/{id}', [BlogController::class, 'update']);
    Route::post('/blog/spellcheck', [BlogController::class, 'spellcheck']);
    Route::post('/upload', [UploadController::class, 'store']);
});

// Blog delete: admin only (plus sysadmin override)
Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::delete('/blog/{id}', [BlogController::class, 'destroy']);
});

// Admin user permissions: admin only (plus sysadmin override)
Route::middleware(['auth:sanctum', 'require_any:is_admin'])->prefix('admin')->group(function () {
    Route::get('/material-prices', [MaterialPriceController::class, 'index']);
    Route::post('/material-prices', [MaterialPriceController::class, 'upsert']);
    Route::delete('/material-prices/{materialUid}', [MaterialPriceController::class, 'destroy']);
    Route::get('/subscriber-cell-records', [SubscriberCellRecordController::class, 'adminIndex']);
    Route::get('/users', [UserController::class, 'index']);
    Route::patch('/users/{user}/permissions', [UserController::class, 'updatePermissions']);
    Route::post('/users/{user}/kick-from-joe', [UserController::class, 'kickFromJoe']);
    Route::post('/users/{user}/force-logout', [UserController::class, 'forceLogout']);
    Route::post('/users/{user}/revoke-swc-authorization', [UserController::class, 'revokeSwcAuthorization']);
    Route::post('/users/revoke-swc-authorization-all', [UserController::class, 'revokeAllSwcAuthorizations']);
    Route::post('/users/{user}/reset-system-updater-cursor', [UserController::class, 'resetSystemUpdaterCursor']);
    Route::post('/users/{user}/full-reset-system-updater', [UserController::class, 'fullResetSystemUpdater']);
    Route::post('/users/{user}/revoke-subscription', [UserController::class, 'revokeSubscription']);
    Route::get('/users/faction-subscriptions', [UserController::class, 'factionSubscriptions']);
    Route::post('/users/faction-subscriptions/{subscriptionId}/revoke', [UserController::class, 'revokeFactionSubscription']);
    Route::get('/member-changelog', [MemberChangelogAdminController::class, 'index']);
    Route::post('/member-changelog', [MemberChangelogAdminController::class, 'store']);
    Route::put('/member-changelog/{memberChangelogEntry}', [MemberChangelogAdminController::class, 'update']);
    Route::delete('/member-changelog/{memberChangelogEntry}', [MemberChangelogAdminController::class, 'destroy']);
    Route::post('/member-changelog/generate-from-readme', [MemberChangelogAdminController::class, 'generateFromReadme']);
    Route::get('/member-changelog/export', [MemberChangelogAdminController::class, 'export']);
    Route::post('/member-changelog/import', [MemberChangelogAdminController::class, 'import']);
    Route::get('/nav-preferences', [AdminNavPreferenceController::class, 'show']);
    Route::put('/nav-preferences/recents', [AdminNavPreferenceController::class, 'updateRecents']);
    Route::put('/nav-preferences/favorites', [AdminNavPreferenceController::class, 'updateFavorites']);

    // Support tickets admin
    Route::get('/support-tickets', [SupportTicketAdminController::class, 'index']);
    Route::get('/support-tickets/{supportTicket}', [SupportTicketAdminController::class, 'show']);
    Route::post('/support-tickets/{supportTicket}/reply', [SupportTicketAdminController::class, 'reply']);
    Route::patch('/support-tickets/{supportTicket}/status', [SupportTicketAdminController::class, 'updateStatus']);
    Route::get('/support-tickets-settings', [SupportTicketAdminController::class, 'getSettings']);
    Route::post('/support-tickets-settings', [SupportTicketAdminController::class, 'updateSettings']);
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
        Route::post('/{id}/bonus', [JobsController::class, 'setBonus']);
        Route::post('/{id}/close', [JobsController::class, 'close']);
        Route::post('/{id}/join', [JobsController::class, 'join']);
    });
});

// Job Pay Rates (catalog visible to all members; admin manages)
Route::get('/job-pay-rates', [JobPayRateController::class, 'index']);
Route::middleware(['auth:sanctum', 'require_any:is_admin,is_sysadmin'])->group(function () {
    Route::post('/job-pay-rates', [JobPayRateController::class, 'store']);
    Route::put('/job-pay-rates/{jobPayRate}', [JobPayRateController::class, 'update']);
    Route::delete('/job-pay-rates/{jobPayRate}', [JobPayRateController::class, 'destroy']);
});

// Job Pay Claims
Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    Route::get('/job-pay-claims', [JobPayClaimController::class, 'index']);
    Route::post('/job-pay-claims', [JobPayClaimController::class, 'store']);
});
Route::middleware(['auth:sanctum', 'require_any:is_admin,is_sysadmin'])->group(function () {
    Route::post('/job-pay-claims/{jobPayClaim}/approve', [JobPayClaimController::class, 'approve']);
    Route::post('/job-pay-claims/{jobPayClaim}/reject', [JobPayClaimController::class, 'reject']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->prefix('job-assignments')->group(function () {
    Route::post('/{id}/complete', [JobsController::class, 'completeAssignment']);
    Route::post('/{id}/bonus', [JobsController::class, 'setAssignmentBonus']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    Route::get('/member/changelog', [MemberChangelogController::class, 'index']);
    Route::get('/payments', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'index']);
    Route::get('/payments/pending-count', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'pendingCount']);
    Route::get('/payments/owed-to-me', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'owedToMe']);
    Route::get('/payment-transfers', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'transfers']);
    Route::get('/payment-transfers/unverified-support', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'unverifiedSupportQueue']);
    Route::post('/payments/build-single', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'buildSingle']);
    Route::post('/payments/send-single', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'sendSingle'])->middleware('throttle:payments-send');
    Route::post('/payments/send-bulk', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'sendBulk'])->middleware('throttle:payments-bulk');
    Route::post('/payments/build-bulk', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'buildBulk']);
    Route::post('/payments/pull-credit-log', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'pullCreditLog'])->middleware('throttle:credit-log-pull');
    Route::get('/payments/droidbrain-settings', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'droidBrainSettings']);
    Route::put('/payments/droidbrain-settings', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'updateDroidBrainSettings']);
    Route::post('/payment-transfers/{paymentTransfer}/verify', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'verify']);
    Route::post('/payment-transfers/{paymentTransfer}/manual-verify', [\App\Http\Controllers\Api\Payment\PaymentController::class, 'manualVerify']);
    // Member-only universe (JOE data: scan records, archive)
    Route::get('/universe/search-records', [UniverseController::class, 'searchRecords']);
    Route::get('/universe/sectors/{sector}', [UniverseController::class, 'sector']);
    Route::get('/universe/archive/systems', [UniverseController::class, 'archiveSystems']);
    Route::get('/universe/archive/planets', [UniverseController::class, 'archivePlanets']);
    Route::get('/universe/archive/planets/{planet}', [UniverseController::class, 'archivePlanet']);
    Route::get('/universe/archive/factions', [UniverseController::class, 'archiveFactions']);
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
    Route::post('/universe/pull-all-vehicle-types', [PullController::class, 'runAllVehicleTypes']);
    Route::post('/universe/pull-all-vehicle-types-stream', [PullController::class, 'runAllVehicleTypesStream']);
    Route::post('/universe/pull-all-droid-types', [PullController::class, 'runAllDroidTypes']);
    Route::post('/universe/pull-all-droid-types-stream', [PullController::class, 'runAllDroidTypesStream']);
    Route::post('/universe/pull-all-creature-types', [PullController::class, 'runAllCreatureTypes']);
    Route::post('/universe/pull-all-creature-types-stream', [PullController::class, 'runAllCreatureTypesStream']);
    Route::post('/universe/pull-all-npc-types', [PullController::class, 'runAllNpcTypes']);
    Route::post('/universe/pull-all-npc-types-stream', [PullController::class, 'runAllNpcTypesStream']);
    Route::post('/universe/pull-all-races', [PullController::class, 'runAllRaces']);
    Route::post('/universe/pull-all-races-stream', [PullController::class, 'runAllRacesStream']);
    Route::post('/universe/pull-all-weapon-types', [PullController::class, 'runAllWeaponTypes']);
    Route::post('/universe/pull-all-weapon-types-stream', [PullController::class, 'runAllWeaponTypesStream']);
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

    // Kanban board
    Route::get('/kanban/assignees', [KanbanController::class, 'assignees']);
    Route::get('/kanban', [KanbanController::class, 'index']);
    Route::post('/kanban/columns', [KanbanController::class, 'storeColumn']);
    Route::patch('/kanban/columns/{column}', [KanbanController::class, 'updateColumn']);
    Route::delete('/kanban/columns/{column}', [KanbanController::class, 'destroyColumn']);
    Route::post('/kanban/columns/reorder', [KanbanController::class, 'reorderColumns']);
    Route::post('/kanban/cards', [KanbanController::class, 'storeCard']);
    Route::patch('/kanban/cards/{card}', [KanbanController::class, 'updateCard']);
    Route::delete('/kanban/cards/{card}', [KanbanController::class, 'destroyCard']);
    Route::post('/kanban/cards/reorder', [KanbanController::class, 'reorderCards']);
    Route::post('/kanban/tickets/{ticket}/promote', [KanbanController::class, 'promoteTicket']);
});

// Free tool routes — accessible to any authenticated user
Route::middleware(['auth:sanctum'])->group(function () {
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
    Route::get('/universe/vehicle-types', [UniverseController::class, 'vehicleTypes']);
    Route::get('/universe/vehicle-types/{vehicleType}', [UniverseController::class, 'vehicleType']);
    Route::get('/universe/droid-types', [UniverseController::class, 'droidTypes']);
    Route::get('/universe/droid-types/{droidType}', [UniverseController::class, 'droidType']);
    Route::get('/universe/creature-types', [UniverseController::class, 'creatureTypes']);
    Route::get('/universe/creature-types/{creatureType}', [UniverseController::class, 'creatureType']);
    Route::get('/universe/npc-types', [UniverseController::class, 'npcTypes']);
    Route::get('/universe/npc-types/{npcType}', [UniverseController::class, 'npcType']);
    Route::get('/universe/races', [UniverseController::class, 'races']);
    Route::get('/universe/races/{race}', [UniverseController::class, 'race']);
    Route::get('/universe/weapon-types', [UniverseController::class, 'weaponTypes']);
    Route::get('/universe/weapon-types/{weaponType}', [UniverseController::class, 'weaponType']);
    Route::get('/universe/terrain-types', [UniverseController::class, 'terrainTypes']);
    Route::get('/universe/terrain-types/{terrainType}', [UniverseController::class, 'terrainType']);
    Route::get('/universe/material-types', [UniverseController::class, 'materialTypes']);
    Route::get('/universe/material-types/{materialType}', [UniverseController::class, 'materialType']);
    Route::get('/universe/entity-stats/{entityType}/export.csv', [UniverseEntityStatsController::class, 'exportCsv']);
    Route::get('/material-prices', [MaterialPriceController::class, 'index']);
});

// Public tool routes — accessible to JOE members AND active subscribers
Route::middleware(['auth:sanctum', 'public_tool_access'])->group(function () {
    Route::get('/universe/sectors', [UniverseController::class, 'sectors']);
    Route::get('/universe/cache-manifest', [UniverseController::class, 'cacheManifest']);
    Route::get('/universe/galaxy-snapshot/meta', [UniverseController::class, 'galaxySnapshotMeta']);
    Route::get('/universe/galaxy-snapshot/layer/{layer}', [UniverseController::class, 'galaxySnapshotLayer']);
    Route::get('/universe/map-systems', [UniverseController::class, 'mapSystems']);
    Route::get('/universe/locations/{galx}/{galy}', [UniverseController::class, 'location'])
        ->where('galx', '-?[0-9]+')
        ->where('galy', '-?[0-9]+');
    Route::get('/universe/systems/{system}', [UniverseController::class, 'system']);
    Route::get('/universe/ship-snapshots', [UniverseController::class, 'shipSnapshots']);
    Route::get('/universe/ship-snapshots/{snapshot}', [UniverseController::class, 'shipSnapshotDetail'])
        ->where('snapshot', '[0-9]+');
    Route::get('/universe/subscriber-cell-records', [SubscriberCellRecordController::class, 'index']);
    Route::post('/universe/subscriber-cell-records', [SubscriberCellRecordController::class, 'store']);
    // Cell annotations — JOE members see/edit shared notes; subscribers see/edit only their own scoped notes
    Route::get('/universe/cell-annotations', [CellAnnotationController::class, 'index']);
    Route::post('/universe/cell-annotations', [CellAnnotationController::class, 'upsert']);
    Route::post('/universe/search-records/import-personal-events', [SearchRecordController::class, 'importPersonalEvents'])->middleware('throttle:import-personal-events');
    Route::get('/universe/search-records/import-logs', [SearchRecordController::class, 'importLogs']);
    Route::delete('/universe/search-records/import-logs', [SearchRecordController::class, 'clearImportLogs']);
    Route::get('/universe/hyper-planner', [UniverseController::class, 'hyperPlanner']);
    Route::get('/universe/hyper-plans', [UniverseController::class, 'hyperPlans']);
    Route::post('/universe/hyper-plans', [UniverseController::class, 'storeHyperPlan']);
    Route::delete('/universe/hyper-plans/{hyperPlan}', [UniverseController::class, 'deleteHyperPlan']);
});

// Loading tip management: can_manage_tips OR is_admin OR sysadmin override
Route::middleware(['auth:sanctum', 'require_any:can_manage_tips,is_admin'])->group(function () {
    Route::get('/admin/loading-tips', [AdminLoadingTipController::class, 'index']);
    Route::post('/admin/loading-tips', [AdminLoadingTipController::class, 'store']);
    Route::put('/admin/loading-tips/{loadingTip}', [AdminLoadingTipController::class, 'update']);
    Route::delete('/admin/loading-tips/{loadingTip}', [AdminLoadingTipController::class, 'destroy']);
});

// TOS admin — sysadmin only
Route::middleware(['auth:sanctum', 'sysadmin_only'])->group(function () {
    Route::get('/admin/tos', [AdminTosController::class, 'index']);
    Route::post('/admin/tos', [AdminTosController::class, 'store']);
    Route::put('/admin/tos/{tosDocument}', [AdminTosController::class, 'update']);
    Route::post('/admin/tos/{tosDocument}/publish', [AdminTosController::class, 'publish']);
    Route::delete('/admin/tos/{tosDocument}', [AdminTosController::class, 'destroy']);
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
    Route::get('/astrogation-upload-logs', [AstrogationUploadLogController::class, 'index']);
    Route::post('/astrogation-upload-logs/pull-for-user', [AstrogationUploadLogController::class, 'pullForUser']);
    Route::get('/droidbrain-uploads', [DroidBrainUploadAuditController::class, 'index']);
    Route::get('/discord-bot', [DiscordBotAdminController::class, 'show']);
    Route::post('/discord-bot/contact-recipient', [ContactRequestSettingsController::class, 'update']);
    Route::get('/website-health', [WebsiteHealthController::class, 'show']);
    Route::get('/worker-health', [WorkerHealthController::class, 'show']);
    Route::post('/worker-health/recover-stuck-imports', [WorkerHealthController::class, 'recoverStuckImports']);
    Route::post('/worker-health/run-payments-now', [WorkerHealthController::class, 'runPaymentsNow']);
    Route::post('/worker-health/retry-failed-payments', [WorkerHealthController::class, 'retryFailedPayments']);
    Route::post('/worker-health/retry-import/{id}', [WorkerHealthController::class, 'retryImport']);
    Route::delete('/worker-health/failed-jobs', [WorkerHealthController::class, 'clearFailedJobs']);
    Route::post('/worker-health/reindex-search', [WorkerHealthController::class, 'reindexSearchTab']);
    Route::get('/market-vendors/status', [MarketVendorAdminController::class, 'status']);
    Route::post('/market-vendors/sync-now', [MarketVendorAdminController::class, 'syncNow']);
    Route::get('/site-lock', [SiteLockController::class, 'show']);
    Route::post('/site-lock', [SiteLockController::class, 'update']);
    Route::get('/entity-stats/{entityType}/export.csv', [EntityStatsController::class, 'exportCsv']);
    Route::post('/entity-stats/station-icons/populate', [EntityStatsController::class, 'populateStationIcons']);
    Route::post('/entity-stats/material-icons/populate', [EntityStatsController::class, 'populateMaterialIcons']);
    Route::put('/entity-stats/{entityType}/{entityId}', [EntityStatsController::class, 'update']);

    // Tool store management
    Route::get('/tool-store/settings', [ToolStoreController::class, 'getSettings']);
    Route::put('/tool-store/settings', [ToolStoreController::class, 'updateSettings']);
    Route::get('/tool-store/plans', [ToolStoreAdminController::class, 'indexPlans']);
    Route::put('/tool-store/plans/{key}', [ToolStoreAdminController::class, 'updatePlan']);
    Route::post('/tool-store/seat-tiers', [ToolStoreAdminController::class, 'storeTier']);
    Route::put('/tool-store/seat-tiers/{id}', [ToolStoreAdminController::class, 'updateTier']);
    Route::delete('/tool-store/seat-tiers/{id}', [ToolStoreAdminController::class, 'destroyTier']);
    Route::get('/tool-store/deals', [ToolStoreAdminController::class, 'indexDeals']);
    Route::post('/tool-store/deals', [ToolStoreAdminController::class, 'storeDeal']);
    Route::put('/tool-store/deals/{id}', [ToolStoreAdminController::class, 'updateDeal']);
    Route::delete('/tool-store/deals/{id}', [ToolStoreAdminController::class, 'destroyDeal']);
    Route::post('/tool-store/subscriber-preview/toggle', [ToolStoreAdminController::class, 'toggleSubscriberPreview']);
    Route::post('/tool-store/lock-joe-flags/toggle', [ToolStoreAdminController::class, 'toggleLockJoeFlags']);
    Route::get('/tool-store/users/search', [ToolStoreAdminController::class, 'searchUsers']);
    Route::post('/tool-store/grant', [ToolStoreAdminController::class, 'grantSubscription']);
    Route::post('/tool-store/grant-faction', [ToolStoreAdminController::class, 'grantFactionSubscription']);
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/swc/authorization', [SwcAuthorizationController::class, 'show']);
    Route::put('/swc/authorization/preferences', [SwcAuthorizationController::class, 'updatePreferences']);
    Route::get('/character-location', [CharacterLocationController::class, 'show'])->middleware('throttle:30,1');
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/member-tools/access', [MemberToolAccessController::class, 'store']);
    Route::post('/extension/authorize-action', [HelperAuthController::class, 'authorizeAction'])->middleware('throttle:120,1');
    Route::post('/extension/wrecking-helper/token', [HelperAuthController::class, 'issueToken'])->middleware('throttle:30,1');
    Route::delete('/extension/wrecking-helper/token', [HelperAuthController::class, 'revokeToken'])->middleware('throttle:30,1');
    Route::get('/extension/wrecking-helper/settings', [HelperSettingsController::class, 'show'])->middleware('throttle:120,1');
    Route::put('/extension/wrecking-helper/settings', [HelperSettingsController::class, 'update'])->middleware('throttle:120,1');
});

Route::middleware(['auth:sanctum', 'public_tool_access'])->group(function () {
    Route::get('/droidbrain', [DroidBrainController::class, 'index']);
    Route::get('/droidbrain/history', [DroidBrainController::class, 'history']);
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/droidbrain/upload', [DroidBrainController::class, 'upload']);
    Route::get('/droidbrain/upload-queue/{queueId}', [DroidBrainController::class, 'uploadQueueStatus']);
});

Route::middleware(['auth:sanctum', 'require_any:is_intel,is_sysadmin'])->group(function () {
    Route::get('/droidbrain/uploads/{fileId}/debug', [DroidBrainController::class, 'uploadDebug']);
});

Route::middleware(['auth:sanctum', 'require_any:is_sysadmin'])->group(function () {
    Route::post('/droidbrain/uploads/{fileId}/reward-payment', [DroidBrainController::class, 'createRewardPayment']);
});

Route::get('/tenets-of-salvage', [TenetOfSalvageController::class, 'index']);

Route::middleware(['auth:sanctum', 'require_any:is_admin'])->group(function () {
    Route::get('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'index']);
    Route::post('/admin/tenets-of-salvage', [AdminTenetOfSalvageController::class, 'store']);
    Route::put('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'update']);
    Route::delete('/admin/tenets-of-salvage/{tenetOfSalvage}', [AdminTenetOfSalvageController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'sysadmin_only'])->prefix('sys/debug')->group(function () {
    Route::get('/runtime', [DebugController::class, 'runtime']);
    Route::get('/combat-settings', [DebugController::class, 'combatSettings']);
    Route::put('/combat-settings', [DebugController::class, 'updateCombatSettings']);
    Route::get('/swc-auth', [DebugController::class, 'swcAuth']);
    Route::get('/payments', [DebugController::class, 'payments']);
    Route::get('/factions', [DebugController::class, 'factions']);
    Route::get('/raw-swc', [DebugController::class, 'rawSwc']);
    Route::get('/events-history', [DebugController::class, 'eventsHistory']);
    Route::post('/events-history/import', [DebugController::class, 'importEventsHistory']);
    Route::get('/astrogation/system-updater-cursor', [DebugController::class, 'showSystemUpdaterCursor']);
    Route::post('/astrogation/system-updater-cursor/reset', [DebugController::class, 'resetSystemUpdaterCursor']);
    Route::get('/test-faction-privilege', [DebugController::class, 'testFactionPrivilege']);
    Route::post('/test-payment', [DebugController::class, 'testPayment']);
    Route::post('/pull-credit-log', [DebugController::class, 'pullCreditLog']);
    Route::post('/test-refresh-token', [DebugController::class, 'testRefreshToken']);
    Route::post('/test-tag', [DebugController::class, 'testTag']);
});

Route::middleware(['auth:sanctum'])->group(function () {
    // Market — all logged-in users
    Route::get('/market/listings', [MarketListingController::class, 'index']);
    Route::get('/market/faction-store', [FactionStoreController::class, 'index']);
    Route::get('/market/orders/mine', [MarketOrderController::class, 'myOrders']);
    Route::post('/market/listings/{marketListing}/orders', [MarketOrderController::class, 'store'])->middleware('throttle:market-order');
    Route::post('/market/orders/{marketOrder}/pay', [MarketOrderController::class, 'pay'])->middleware('throttle:market-pay');
    Route::post('/market/orders/{marketOrder}/cancel', [MarketOrderController::class, 'cancel']);
    Route::post('/market/orders/{marketOrder}/dispute', [MarketOrderController::class, 'dispute']);
});

Route::middleware(['auth:sanctum', 'member_tool_access'])->group(function () {
    // Market — JOE member tools access required
    Route::get('/market/listings/mine', [MarketListingController::class, 'myListings']);
    Route::get('/market/listings/{marketListing}', [MarketListingController::class, 'show']);
    Route::post('/market/listings', [MarketListingController::class, 'store']);
    Route::post('/market/listings/{marketListing}/cancel', [MarketListingController::class, 'cancel']);
    Route::post('/market/faction-store', [FactionStoreController::class, 'store']);
    Route::get('/market/orders/to-fulfill', [MarketOrderController::class, 'pendingFulfillment']);
    Route::get('/market/orders/{marketOrder}', [MarketOrderController::class, 'show']);
    Route::post('/market/orders/{marketOrder}/fulfill', [MarketOrderController::class, 'fulfill']);
    Route::post('/market/orders/{marketOrder}/confirm-material', [MarketOrderController::class, 'confirmMaterial']);
    Route::post('/market/orders/{marketOrder}/refund', [MarketOrderController::class, 'refund']);
    Route::post('/market/orders/{marketOrder}/retry-transfer', [MarketOrderController::class, 'retryTransfer']);
    Route::post('/market/orders/{marketOrder}/mark-complete', [MarketOrderController::class, 'markComplete']);
    Route::get('/market/inventory/personal', [MarketInventoryController::class, 'personalInventory']);
    Route::get('/market/inventory/faction', [MarketInventoryController::class, 'factionInventory']);
    Route::get('/market/inventory/entity', [MarketInventoryController::class, 'entityDetail']);
    Route::get('/market/entity-types/search', [MarketEntityTypeSearchController::class, 'search']);
    Route::post('/market/custom-image/upload', [MarketCustomImageController::class, 'upload']);

    Route::get('/factions/mine/payable', [FactionController::class, 'minePayable']);
    Route::get('/manual-payment-templates', [ManualPaymentTemplateController::class, 'index']);
    Route::get('/manual-payment-templates/options', [ManualPaymentTemplateController::class, 'options']);
    Route::post('/manual-payment-templates', [ManualPaymentTemplateController::class, 'store']);
    Route::put('/manual-payment-templates/{manualPaymentTemplate}', [ManualPaymentTemplateController::class, 'update']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/toggle', [ManualPaymentTemplateController::class, 'toggle']);
    Route::post('/manual-payment-templates/{manualPaymentTemplate}/generate', [ManualPaymentTemplateController::class, 'generate']);
    Route::delete('/manual-payment-templates/{manualPaymentTemplate}', [ManualPaymentTemplateController::class, 'destroy']);
    Route::get('/factions/mine/privileges', [FactionPrivilegeController::class, 'mine']);
    
});

Route::middleware(['auth:sanctum', 'require_any:can_access_rm_browser,is_admin,is_sysadmin'])->group(function () {
    Route::get('/rm-browser/materials', [RmBrowserController::class, 'search'])->middleware('throttle:rm-browser');
});

Route::middleware(['auth:sanctum', 'require_any:is_joe_member,is_admin,is_sysadmin'])->group(function () {
    Route::get('/xp-tracker', [XpTrackerController::class, 'fetch'])->middleware('throttle:60,10');
    Route::get('/fire-delays', [FireDelayController::class, 'fetch'])->middleware('throttle:12,1');
    Route::get('/fire-delays/settings', [FireDelayController::class, 'getSettings']);
    Route::put('/fire-delays/settings', [FireDelayController::class, 'updateSettings'])->middleware('sysadmin_only');
    Route::get('/market-vendors', [MarketVendorController::class, 'index']);
    Route::get('/market-vendors/vendors', [MarketVendorController::class, 'vendors']);
    Route::get('/market-vendors/owners', [MarketVendorController::class, 'owners']);
    Route::get('/market-vendors/hubs', [MarketVendorController::class, 'hubs']);
    Route::get('/market-vendors/vendors/{id}', [MarketVendorController::class, 'show']);
    Route::get('/bounty-contracts', [BountyHuntingController::class, 'index']);
    Route::get('/bounty-contracts/candidate-worlds', [BountyHuntingController::class, 'candidateWorlds']);
    Route::post('/bounty-contracts', [BountyHuntingController::class, 'store']);
    Route::put('/bounty-contracts/{bountyContract}', [BountyHuntingController::class, 'update']);
    Route::delete('/bounty-contracts/{bountyContract}', [BountyHuntingController::class, 'destroy']);
    Route::post('/bounty-contracts/{bountyContract}/scans', [BountyHuntingController::class, 'storeScan']);
    Route::put('/bounty-contracts/{bountyContract}/scans/{scan}', [BountyHuntingController::class, 'updateScan']);
    Route::delete('/bounty-contracts/{bountyContract}/scans/{scan}', [BountyHuntingController::class, 'destroyScan']);
});

Route::middleware(['auth:sanctum', 'require_any:is_joe_member,can_access_fleet_commander,is_admin,is_sysadmin'])->group(function () {
    Route::get('/fleet/my-skills', [SkillsToolController::class, 'mySkills']);
    Route::get('/fleet/skill-plan', [SkillsToolController::class, 'getPlan']);
    Route::post('/fleet/skill-plan', [SkillsToolController::class, 'savePlan']);
});

Route::middleware(['auth:sanctum', 'require_any:can_access_fleet_commander,is_admin,is_sysadmin'])->group(function () {
    Route::get('/fleet/members', [SkillsToolController::class, 'members']);
    Route::get('/fleet/roster-matrix', [SkillsToolController::class, 'rosterMatrix']);
    Route::get('/fleet/member-skills/{uid}', [SkillsToolController::class, 'memberSkills']);
});
