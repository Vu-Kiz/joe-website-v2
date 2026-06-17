<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TosDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TosController extends Controller
{
    public function current(): JsonResponse
    {
        $tos = TosDocument::active();

        if (!$tos) {
            return response()->json([
                'ok'      => true,
                'tos'     => null,
            ]);
        }

        return response()->json([
            'ok'  => true,
            'tos' => [
                'version'      => $tos->version,
                'content'      => $tos->content,
                'published_at' => $tos->published_at?->toIso8601String(),
            ],
        ]);
    }

    public function accept(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $activeVersion = TosDocument::activeVersion();

        if (!$activeVersion) {
            return response()->json(['ok' => false, 'message' => 'No active TOS found.'], 422);
        }

        $user->tos_accepted_version = $activeVersion;
        $user->save();

        return response()->json(['ok' => true]);
    }
}
