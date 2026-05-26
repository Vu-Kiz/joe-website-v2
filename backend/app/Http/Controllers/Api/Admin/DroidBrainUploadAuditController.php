<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DroidBrainUploadAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:200'],
            'user' => ['nullable', 'string', 'max:160'],
            'q' => ['nullable', 'string', 'max:255'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $userNeedle = trim((string) ($validated['user'] ?? ''));
        $queryNeedle = trim((string) ($validated['q'] ?? ''));
        $dateFrom = isset($validated['date_from']) ? trim((string) $validated['date_from']) : '';
        $dateTo = isset($validated['date_to']) ? trim((string) $validated['date_to']) : '';

        // Start from the queue so pending/stuck uploads appear even before a file record is created.
        $query = DB::table('droidbrain_upload_queue_items as queue_item')
            ->leftJoin('droidbrain_files as file', 'file.id', '=', 'queue_item.result_file_id')
            ->leftJoin('users as user', 'user.id', '=', 'queue_item.user_id')
            ->leftJoin('droidbrain_uploaders as uploader', 'uploader.user_id', '=', 'queue_item.user_id')
            ->orderByDesc('queue_item.created_at')
            ->orderByDesc('queue_item.id');

        if ($userNeedle !== '') {
            $query->where(function ($sub) use ($userNeedle) {
                $needle = '%' . $userNeedle . '%';
                $sub->where('file.uploader_handle', 'like', $needle)
                    ->orWhere('uploader.handle', 'like', $needle)
                    ->orWhere('user.swc_handle', 'like', $needle)
                    ->orWhere('user.discord_global_name', 'like', $needle)
                    ->orWhere('user.discord_username', 'like', $needle)
                    ->orWhere('uploader.swc_uid', 'like', $needle);
            });
        }

        if ($queryNeedle !== '') {
            $query->where(function ($sub) use ($queryNeedle) {
                $needle = '%' . $queryNeedle . '%';
                $sub->where('queue_item.file_name', 'like', $needle)
                    ->orWhere('file.payload_type', 'like', $needle)
                    ->orWhere('file.change_status', 'like', $needle)
                    ->orWhere('queue_item.status', 'like', $needle)
                    ->orWhere('file.uploader_handle', 'like', $needle);
            });
        }

        if ($dateFrom !== '') {
            $query->whereDate('queue_item.created_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $query->whereDate('queue_item.created_at', '<=', $dateTo);
        }

        $paginator = $query->paginate(
            $perPage,
            [
                'queue_item.id as queue_item_id',
                'queue_item.file_name as queue_file_name',
                'queue_item.status as queue_status',
                'queue_item.error_message as queue_error_message',
                'queue_item.processed_at as queue_processed_at',
                'queue_item.created_at as queue_created_at',
                'file.id as file_id',
                'file.file_name',
                'file.payload_type',
                'file.snapshot_unix',
                'file.uploader_swc_uid',
                'file.uploader_handle',
                'file.change_status',
                'file.new_entities_count',
                'file.modified_entities_count',
                'file.unchanged_entities_count',
                'file.updated_at',
                'uploader.user_id as uploader_user_id',
                'uploader.handle as uploader_record_handle',
                'uploader.swc_uid as uploader_record_swc_uid',
                'user.swc_handle as uploader_user_swc_handle',
                'user.discord_global_name as uploader_user_discord_global_name',
                'user.discord_username as uploader_user_discord_username',
            ],
            'page',
            $page
        );

        $uploads = $paginator->getCollection()->map(function ($row) {
            $newCount = (int) ($row->new_entities_count ?? 0);
            $modifiedCount = (int) ($row->modified_entities_count ?? 0);
            $unchangedCount = (int) ($row->unchanged_entities_count ?? 0);
            $hasFile = !empty($row->file_id);

            return [
                'id' => (int) $row->queue_item_id,
                'queue_item_id' => (int) $row->queue_item_id,
                'queue_status' => $row->queue_status ? (string) $row->queue_status : null,
                'queue_error_message' => $row->queue_error_message ? trim((string) $row->queue_error_message) : null,
                'queue_processed_at' => $row->queue_processed_at ? (string) $row->queue_processed_at : null,
                'file_name' => $hasFile ? (string) $row->file_name : (string) $row->queue_file_name,
                'payload_type' => $row->payload_type ? (string) $row->payload_type : null,
                'snapshot_unix' => $row->snapshot_unix ? (int) $row->snapshot_unix : null,
                'change_status' => $hasFile ? (string) $row->change_status : $row->queue_status ?? 'pending',
                'new_entities_count' => $newCount,
                'modified_entities_count' => $modifiedCount,
                'unchanged_entities_count' => $unchangedCount,
                'total_entities_count' => $newCount + $modifiedCount + $unchangedCount,
                'uploader_user_id' => $row->uploader_user_id ? (int) $row->uploader_user_id : null,
                'uploader_handle' => $row->uploader_handle ? (string) $row->uploader_handle : null,
                'uploader_swc_uid' => $row->uploader_swc_uid ? (string) $row->uploader_swc_uid : null,
                'uploader_record_handle' => $row->uploader_record_handle ? (string) $row->uploader_record_handle : null,
                'uploader_record_swc_uid' => $row->uploader_record_swc_uid ? (string) $row->uploader_record_swc_uid : null,
                'uploader_user_swc_handle' => $row->uploader_user_swc_handle ? (string) $row->uploader_user_swc_handle : null,
                'uploader_user_discord_global_name' => $row->uploader_user_discord_global_name ? (string) $row->uploader_user_discord_global_name : null,
                'uploader_user_discord_username' => $row->uploader_user_discord_username ? (string) $row->uploader_user_discord_username : null,
                'created_at' => $row->queue_created_at ? (string) $row->queue_created_at : null,
                'updated_at' => $row->updated_at ? (string) $row->updated_at : null,
            ];
        })->values();

        $uploaderOptions = DB::table('users')
            ->whereNotNull('swc_handle')
            ->whereRaw("TRIM(swc_handle) <> ''")
            ->whereExists(function ($sub) {
                $sub->select(DB::raw(1))
                    ->from('droidbrain_upload_queue_items')
                    ->whereColumn('droidbrain_upload_queue_items.user_id', 'users.id');
            })
            ->orderBy('swc_handle')
            ->limit(250)
            ->pluck('swc_handle')
            ->map(fn ($value) => (string) $value)
            ->values();

        return response()->json([
            'ok' => true,
            'data' => [
                'uploads' => $uploads,
                'pagination' => [
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
                'filters' => [
                    'user' => $userNeedle !== '' ? $userNeedle : null,
                    'q' => $queryNeedle !== '' ? $queryNeedle : null,
                    'date_from' => $dateFrom !== '' ? $dateFrom : null,
                    'date_to' => $dateTo !== '' ? $dateTo : null,
                ],
                'uploader_options' => $uploaderOptions,
            ],
        ]);
    }
}

