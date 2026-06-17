<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\TosDocument;
use App\Support\Admin\AdminActionLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminTosController extends Controller
{
    private function formatDoc(TosDocument $doc): array
    {
        return [
            'id'           => $doc->id,
            'version'      => $doc->version,
            'content'      => $doc->content,
            'is_active'    => $doc->is_active,
            'published_at' => $doc->published_at?->toIso8601String(),
            'created_at'   => $doc->created_at?->toIso8601String(),
        ];
    }

    public function index(): JsonResponse
    {
        $docs = TosDocument::query()
            ->orderByDesc('version')
            ->get()
            ->map(fn (TosDocument $doc) => $this->formatDoc($doc))
            ->values();

        return response()->json(['ok' => true, 'documents' => $docs]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string'],
        ]);

        $nextVersion = (TosDocument::max('version') ?? 0) + 1;

        $doc = TosDocument::create([
            'version'   => $nextVersion,
            'content'   => trim($validated['content']),
            'is_active' => false,
        ]);

        AdminActionLogger::log(
            $request,
            'tos',
            'create',
            "Created TOS draft v{$doc->version}",
            'tos_document',
            $doc->id,
            null,
            ['version' => $doc->version]
        );

        return response()->json(['ok' => true, 'document' => $this->formatDoc($doc)], 201);
    }

    public function update(Request $request, TosDocument $tosDocument): JsonResponse
    {
        if ($tosDocument->is_active) {
            return response()->json(['ok' => false, 'message' => 'Cannot edit the active TOS version. Create a new draft instead.'], 422);
        }

        $validated = $request->validate([
            'content' => ['required', 'string'],
        ]);

        $before = ['content' => $tosDocument->content];

        $tosDocument->content = trim($validated['content']);
        $tosDocument->save();

        AdminActionLogger::log(
            $request,
            'tos',
            'update',
            "Updated TOS draft v{$tosDocument->version}",
            'tos_document',
            $tosDocument->id,
            $before,
            ['content' => $tosDocument->content]
        );

        return response()->json(['ok' => true, 'document' => $this->formatDoc($tosDocument)]);
    }

    public function publish(Request $request, TosDocument $tosDocument): JsonResponse
    {
        if ($tosDocument->is_active) {
            return response()->json(['ok' => false, 'message' => 'This version is already active.'], 422);
        }

        if (!trim($tosDocument->content)) {
            return response()->json(['ok' => false, 'message' => 'Cannot publish an empty TOS document.'], 422);
        }

        // Deactivate any currently active version
        TosDocument::where('is_active', true)->update(['is_active' => false]);

        $tosDocument->is_active    = true;
        $tosDocument->published_at = now();
        $tosDocument->save();

        AdminActionLogger::log(
            $request,
            'tos',
            'publish',
            "Published TOS v{$tosDocument->version} — all users must re-accept",
            'tos_document',
            $tosDocument->id,
            null,
            ['version' => $tosDocument->version]
        );

        return response()->json(['ok' => true, 'document' => $this->formatDoc($tosDocument)]);
    }

    public function destroy(Request $request, TosDocument $tosDocument): JsonResponse
    {
        if ($tosDocument->is_active) {
            return response()->json(['ok' => false, 'message' => 'Cannot delete the active TOS version.'], 422);
        }

        $targetId = $tosDocument->id;
        $version  = $tosDocument->version;

        $tosDocument->delete();

        AdminActionLogger::log(
            $request,
            'tos',
            'delete',
            "Deleted TOS draft v{$version}",
            'tos_document',
            $targetId,
            ['version' => $version],
            null
        );

        return response()->json(['ok' => true]);
    }
}
