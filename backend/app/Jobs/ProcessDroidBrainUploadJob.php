<?php

namespace App\Jobs;

use App\Models\User;
use App\Support\DroidBrain\DroidBrainUploadService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\UploadedFile;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class ProcessDroidBrainUploadJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;
    public int $timeout = 3600;

    public function __construct(
        public int $queueItemId
    ) {
        $this->onConnection('database');
        $this->onQueue('xml-imports');
    }

    public function handle(DroidBrainUploadService $uploadService): void
    {
        $queueItem = DB::transaction(function () {
            $item = DB::table('droidbrain_upload_queue_items')
                ->where('id', $this->queueItemId)
                ->lockForUpdate()
                ->first();

            if (!$item || $item->status === 'completed') {
                return null;
            }

            // If a previous attempt died mid-job (OOM, hard timeout, worker kill)
            // the item stays in 'processing' forever because failed() was never
            // called. Reclaim it after a safe threshold so it can be retried.
            if ($item->status === 'processing') {
                $stuckThreshold = now()->subHours(2);
                if ($item->updated_at > $stuckThreshold->toDateTimeString()) {
                    return null;
                }
                // Older than 2h in processing — assume dead, reclaim below.
            }

            DB::table('droidbrain_upload_queue_items')
                ->where('id', $this->queueItemId)
                ->update([
                    'status' => 'processing',
                    'error_message' => null,
                    'updated_at' => now(),
                ]);

            return $item;
        });

        if (!$queueItem) {
            return;
        }

        $user = User::query()->find((int) $queueItem->user_id);
        if (!$user) {
            throw new \RuntimeException('Upload queue item has no valid user.');
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'droidbrain_upload_');
        if ($tempPath === false) {
            throw new \RuntimeException('Failed to create a temporary upload file.');
        }

        try {
            $written = file_put_contents($tempPath, (string) $queueItem->raw_xml);
            if ($written === false) {
                throw new \RuntimeException('Failed to write queued XML to a temporary file.');
            }

            $uploadedFile = new UploadedFile(
                $tempPath,
                (string) ($queueItem->file_name ?: 'droidbrain-upload.xml'),
                $queueItem->file_mime_type ? (string) $queueItem->file_mime_type : 'application/xml',
                null,
                true
            );

            $summary = $uploadService->ingest($uploadedFile, $user);

            DB::table('droidbrain_upload_queue_items')
                ->where('id', $this->queueItemId)
                ->update([
                    'status' => 'completed',
                    'result_file_id' => isset($summary['file_id']) ? (int) $summary['file_id'] : null,
                    'result_payload' => json_encode($summary, JSON_UNESCAPED_SLASHES),
                    'raw_xml' => null,
                    'error_message' => null,
                    'processed_at' => now(),
                    'updated_at' => now(),
                ]);
        } finally {
            if (is_file($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    public function failed(\Throwable $exception): void
    {
        DB::table('droidbrain_upload_queue_items')
            ->where('id', $this->queueItemId)
            ->update([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'processed_at' => now(),
                'updated_at' => now(),
            ]);
    }
}
