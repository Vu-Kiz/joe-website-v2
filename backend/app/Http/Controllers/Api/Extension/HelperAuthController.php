<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Extension;

use App\Http\Controllers\Controller;
use App\Support\Swc\Auth\Permissions;
use App\Support\Extension\ExtensionAuthHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HelperAuthController extends Controller
{
    private const TOKEN_NAME = 'wrecking-helper-extension';

    public function authorizeAction(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'allowed' => false,
                'reason' => 'Unauthenticated.',
            ], 401);
        }

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['stamp', 'countback', 'recycle'])],
            'context' => ['nullable', 'array'],
        ]);

        $action = (string) $validated['action'];

        $accessToken = $request->user()?->currentAccessToken();
        if ($accessToken && !$request->user()?->tokenCan('wrecking-helper')) {
            return response()->json([
                'allowed' => false,
                'reason' => 'Extension token does not include required ability.',
                'action' => $action,
            ], 403);
        }

        $authorization = ExtensionAuthHelper::canUseExtensionAction($user, $action);

        return response()->json([
            'allowed' => (bool) ($authorization['allowed'] ?? false),
            'reason' => (string) ($authorization['reason'] ?? ''),
            'action' => $action,
            'required_flags' => $authorization['required_flags'] ?? [],
            'missing_flags' => $authorization['missing_flags'] ?? [],
            'server_time' => now()->toIso8601String(),
        ], ($authorization['allowed'] ?? false) ? 200 : 403);
    }

    public function issueToken(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!Permissions::hasAny($user, ['can_access_wrecking_helper_extension'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have access to Wrecking Helper.',
            ], 403);
        }

        $user->tokens()->where('name', self::TOKEN_NAME)->delete();
        $plainTextToken = $user->createToken(self::TOKEN_NAME, ['wrecking-helper'])->plainTextToken;

        return response()->json([
            'ok' => true,
            'token' => $plainTextToken,
            'token_name' => self::TOKEN_NAME,
        ]);
    }

    public function revokeToken(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!Permissions::hasAny($user, ['can_access_wrecking_helper_extension'], true)) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have access to Wrecking Helper.',
            ], 403);
        }

        $deleted = $user->tokens()->where('name', self::TOKEN_NAME)->delete();

        return response()->json([
            'ok' => true,
            'revoked_count' => (int) $deleted,
        ]);
    }
}
