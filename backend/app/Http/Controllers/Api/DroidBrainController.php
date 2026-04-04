<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Admin\AdminActionLogger;
use App\Support\DroidBrain\DroidBrainBrowserService;
use App\Support\DroidBrain\DroidBrainRewardService;
use App\Support\DroidBrain\DroidBrainUploadService;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DroidBrainController extends Controller
{
    public function __construct(
        protected DroidBrainBrowserService $browserService,
        protected DroidBrainUploadService $uploadService,
        protected DroidBrainRewardService $rewardService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $fullAccess = (bool) ($user->is_intel || $user->is_sysadmin);

        return response()->json([
            'ok' => true,
            'data' => $this->browserService->buildContext($request->query(), !$fullAccess),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $fullAccess = (bool) ($user->is_intel || $user->is_sysadmin);

        $validated = $request->validate([
            'tab' => ['required', 'string'],
            'uid' => ['required', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        return response()->json([
            'ok' => true,
            'data' => $this->browserService->buildHistory(
                (string) $validated['tab'],
                (string) $validated['uid'],
                (int) ($validated['limit'] ?? 10),
                !$fullAccess
            ),
        ]);
    }

    public function upload(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:text/xml,application/xml,text/plain,application/rss+xml,application/octet-stream'],
        ]);

        $summary = $this->uploadService->ingest($validated['file'], $user);
        if (!$summary['duplicate']) {
            $summary['reward_summary'] = $this->rewardService->syncForFile((int) $summary['file_id'], null, true);
        }

        if (!(bool) $user->is_sysadmin) {
            unset($summary['reward_summary']);
        }

        return response()->json([
            'ok' => true,
            'data' => $summary,
        ]);
    }

    public function uploadDebug(Request $request, int $fileId): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $file = DB::table('droidbrain_files')->where('id', $fileId)->first();
        if (!$file) {
            return response()->json(['message' => 'Upload not found.'], 404);
        }

        $entityCounts = [
            'ships' => DB::table('droidbrain_ships')->where('file_id', $fileId)->count(),
            'stations' => DB::table('droidbrain_stations')->where('file_id', $fileId)->count(),
            'planets' => DB::table('droidbrain_planets')->where('file_id', $fileId)->count(),
            'cities' => DB::table('droidbrain_cities')->where('file_id', $fileId)->count(),
            'vehicles' => DB::table('droidbrain_vehicles')->where('file_id', $fileId)->count(),
            'npcs' => DB::table('droidbrain_npcs')->where('file_id', $fileId)->count(),
            'system_scans' => DB::table('droidbrain_system_scans')->where('file_id', $fileId)->count(),
        ];

        $scanIds = DB::table('droidbrain_system_scans')
            ->where('file_id', $fileId)
            ->pluck('id');

        $scanObjects = $scanIds->isEmpty()
            ? []
            : DB::table('droidbrain_system_scan_objects')
                ->join('droidbrain_system_scans', 'droidbrain_system_scans.id', '=', 'droidbrain_system_scan_objects.scan_id')
                ->whereIn('scan_id', $scanIds)
                ->orderBy('droidbrain_system_scan_objects.id')
                ->limit(10)
                ->get([
                    'droidbrain_system_scan_objects.id',
                    'droidbrain_system_scan_objects.scan_id',
                    'droidbrain_system_scan_objects.object_type',
                    'droidbrain_system_scan_objects.object_uid',
                    'droidbrain_system_scan_objects.object_name',
                    'droidbrain_system_scan_objects.galx',
                    'droidbrain_system_scan_objects.galy',
                    'droidbrain_system_scan_objects.sysx',
                    'droidbrain_system_scan_objects.sysy',
                    'droidbrain_system_scans.system_name',
                ])
                ->map(fn ($row) => (array) $row)
                ->all();

        $rewardLogs = DB::table('droidbrain_reward_logs')
            ->where('file_id', $fileId)
            ->orderBy('id')
            ->get([
                'id',
                'payment_item_id',
                'galx',
                'galy',
                'system_name',
                'reward_status',
                'is_new_system',
                'new_entities_count',
                'modified_entities_count',
                'unchanged_entities_count',
                'total_amount',
                'cooldown_until',
            ])
            ->map(fn ($row) => (array) $row)
            ->all();

        $rewardPayment = $this->rewardService->syncForFile($fileId);
        $payerOptions = [];
        if ((bool) $user->is_sysadmin) {
            $payerOptions = DB::table('factions')
                ->orderBy('name')
                ->get(['id', 'name', 'swc_uid', 'abbreviation'])
                ->map(fn ($row) => (array) $row)
                ->all();
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'file' => [
                    'id' => (int) $file->id,
                    'file_name' => $file->file_name,
                    'payload_type' => $file->payload_type,
                    'snapshot_unix' => $file->snapshot_unix ? (int) $file->snapshot_unix : null,
                    'change_status' => $file->change_status,
                    'new_entities_count' => (int) $file->new_entities_count,
                    'modified_entities_count' => (int) $file->modified_entities_count,
                    'unchanged_entities_count' => (int) $file->unchanged_entities_count,
                    'uploader_handle' => $file->uploader_handle,
                    'created_at' => $file->created_at,
                ],
                'entity_counts' => $entityCounts,
                'scan_objects_preview' => $scanObjects,
                'reward_logs' => $rewardLogs,
                'reward_payment' => (bool) $user->is_sysadmin ? $rewardPayment : null,
                'payer_options' => $payerOptions,
            ],
        ]);
    }

    public function createRewardPayment(Request $request, int $fileId): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!(bool) $user->is_sysadmin) {
            return response()->json(['message' => 'Only sysadmins can create DroidBrain payment items.'], 403);
        }

        $validated = $request->validate([
            'payer_faction_id' => ['required', 'integer', Rule::exists('factions', 'id')],
        ]);

        $summary = $this->rewardService->syncForFile($fileId, (int) $validated['payer_faction_id'], true);
        if (!$summary) {
            return response()->json(['message' => 'No DroidBrain reward summary could be built for that upload.'], 404);
        }

        AdminActionLogger::log(
            $request,
            'droidbrain',
            'create_reward_payment',
            'Created or refreshed a DroidBrain reward payment item.',
            'droidbrain_file',
            $fileId,
            null,
            [
                'payer_faction_id' => (int) $validated['payer_faction_id'],
                'payment_item_id' => $summary['payment_item_id'] ?? null,
                'total_amount' => $summary['total_amount'] ?? null,
            ]
        );

        return response()->json([
            'ok' => true,
            'data' => $summary,
        ]);
    }
}
