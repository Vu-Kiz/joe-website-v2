<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\PaymentItem;
use App\Models\PaymentTransfer;
use App\Models\User;
use App\Support\Payments\PaymentVerificationService;
use App\Support\Swc\SwcHttp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Validation\Rule;

class SysadminDebugController extends Controller
{
    public function __construct(
        protected PaymentVerificationService $paymentVerificationService
    ) {
    }

    protected function resolveTargetUser(Request $request, array $with = []): ?User
    {
        $targetUserId = (int) $request->query('user_id', 0);

        if ($targetUserId > 0) {
            return User::with($with)->find($targetUserId);
        }

        $user = $request->user();

        if (!$user) {
            return null;
        }

        return !empty($with) ? $user->load($with) : $user;
    }

    public function swcAuth(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorization', 'factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $user->swcAuthorization;

        $grantedScopes = trim((string) ($auth?->granted_scopes ?? ''));
        $scopes = $grantedScopes !== ''
            ? preg_split('/\s+/', $grantedScopes) ?: []
            : [];

        $hasPersonalCreditLogAccess =
            in_array('character_credits', $scopes, true) ||
            in_array('character_all', $scopes, true);

        $hasFactionCreditLogAccess =
            in_array('faction_credits_read', $scopes, true) ||
            in_array('faction_all', $scopes, true);

        $hasCharacterPrivilegesAccess =
            in_array('character_privileges', $scopes, true) ||
            in_array('character_all', $scopes, true);

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                    'is_sysadmin' => (bool) $user->is_sysadmin,
                ],
                'authorization' => [
                    'exists' => (bool) $auth,
                    'granted_scopes' => $auth?->granted_scopes,
                    'has_personal_credit_log_access' => $hasPersonalCreditLogAccess,
                    'has_faction_credit_log_access' => $hasFactionCreditLogAccess,
                    'has_character_privileges_access' => $hasCharacterPrivilegesAccess,
                    'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                    'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                    'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                    'has_access_token' => !empty($auth?->access_token_encrypted),
                    'has_refresh_token' => !empty($auth?->refresh_token_encrypted),
                ],
                'factions' => $user->factions->map(function ($faction) {
                    return [
                        'id' => $faction->id,
                        'name' => $faction->name,
                        'swc_uid' => $faction->swc_uid,
                        'abbreviation' => $faction->abbreviation,
                        'pivot' => [
                            'can_view_payments' => (bool) $faction->pivot?->can_view_payments,
                            'can_pay_from_faction' => (bool) $faction->pivot?->can_pay_from_faction,
                            'can_mark_payments_paid' => (bool) $faction->pivot?->can_mark_payments_paid,
                            'can_manage_jobs' => (bool) $faction->pivot?->can_manage_jobs,
                        ],
                    ];
                })->values(),
                'config' => [
                    'authorize_url' => Config::get('swc.authorize_url'),
                    'token_url' => Config::get('swc.token_url'),
                    'api_base' => Config::get('swc.api_base'),
                    'redirect_uri' => Config::get('swc.redirect_uri'),
                    'default_scope' => Config::get('swc.default_scope'),
                    'events_scope' => Config::get('swc.events_scope'),
                    'debug_scope' => Config::get('swc.debug_scope'),
                    'access_type' => Config::get('swc.access_type'),
                    'events_access_type' => Config::get('swc.events_access_type'),
                    'debug_access_type' => Config::get('swc.debug_access_type'),
                ],
            ],
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['factions']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $factionIds = $user->factions()
            ->wherePivot('can_view_payments', true)
            ->pluck('factions.id');

        $pendingItems = PaymentItem::query()
            ->where('status', 'pending')
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $transfers = PaymentTransfer::query()
            ->where(function ($q) use ($user, $factionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($factionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $factionIds);
                });
            })
            ->with('items')
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                ],
                'visible_faction_ids' => $factionIds->values(),
                'pending_items' => $pendingItems,
                'transfers' => $transfers,
            ],
        ]);
    }

    public function factions(): JsonResponse
    {
        $factions = Faction::query()
            ->orderBy('name')
            ->get(['id', 'name', 'swc_uid', 'abbreviation']);

        return response()->json([
            'ok' => true,
            'data' => $factions,
        ]);
    }

    public function rawSwc(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorization']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $user->swcAuthorization;

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC authorization token found for target user.',
            ], 422);
        }

        $path = trim((string) $request->query('path', ''));

        if ($path === '') {
            return response()->json([
                'ok' => false,
                'message' => 'path is required.',
            ], 422);
        }

        $query = $request->query();
        unset($query['path'], $query['user_id']);

        $normalizedPath = ltrim($path, '/');

        if (!str_contains($normalizedPath, '?') && !str_ends_with($normalizedPath, '/')) {
            $normalizedPath .= '/';
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $url = rtrim((string) config('swc.api_base'), '/') . '/' . $normalizedPath;

        $prefer = trim((string) $request->query('prefer_auth', 'oauth'));
        $modes = $prefer === 'bearer'
            ? ['bearer', 'oauth']
            : ['oauth', 'bearer'];

        $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, $modes);
        $response = $attempt['response'];

        return response()->json([
            'ok' => $response->ok(),
            'status' => $response->status(),
            'auth_mode_used' => $attempt['mode'],
            'auth_modes_tried' => $modes,
            'attempts' => $attempt['attempts'],
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'authorization_summary' => [
                'has_auth_row' => (bool) $auth,
                'has_access_token' => !empty($auth->access_token_encrypted),
                'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                'granted_scopes' => $auth?->granted_scopes,
            ],
            'url' => $url,
            'query' => $query,
            'body' => $response->body(),
            'json' => $response->json(),
        ], 200);
    }

    public function testFactionPrivilege(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorization']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $auth = $user->swcAuthorization;

        if (!$auth || empty($auth->access_token_encrypted)) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC authorization token found for target user.',
            ], 422);
        }

        $group = trim((string) $request->query('group', 'finance'));
        $privilege = trim((string) $request->query('privilege', 'can_transfer'));
        $factionId = trim((string) $request->query('faction_id', ''));

        if ($factionId === '') {
            return response()->json([
                'ok' => false,
                'message' => 'faction_id is required.',
            ], 422);
        }

        $accessToken = decrypt($auth->access_token_encrypted);
        $url = rtrim((string) config('swc.api_base'), '/')
            . '/character/'
            . urlencode((string) $user->swc_character_id)
            . '/privilege/'
            . urlencode($group)
            . '/'
            . urlencode($privilege)
            . '/';

        $attempt = SwcHttp::getWithAuthFallback($url, [
            'faction_id' => $factionId,
        ], $accessToken);

        $response = $attempt['response'];

        return response()->json([
            'ok' => $response->ok(),
            'status' => $response->status(),
            'auth_mode_used' => $attempt['mode'],
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'authorization_summary' => [
                'has_auth_row' => (bool) $auth,
                'has_access_token' => !empty($auth->access_token_encrypted),
                'token_expires_at' => $auth?->token_expires_at?->toIso8601String(),
                'revoked_at' => $auth?->revoked_at?->toIso8601String(),
                'last_verified_at' => $auth?->last_verified_at?->toIso8601String(),
                'granted_scopes' => $auth?->granted_scopes,
            ],
            'url' => $url,
            'query' => [
                'faction_id' => $factionId,
            ],
            'body' => $response->body(),
            'json' => $response->json(),
        ], 200);
    }

    public function testPayment(Request $request): JsonResponse
    {
        $user = $this->resolveTargetUser($request, ['swcAuthorization']);

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $data = $request->validate([
            'payment_transfer_id' => ['nullable', 'integer', 'exists:payment_transfers,id'],
            'payer_subject_type' => ['nullable', Rule::in(['user', 'faction'])],
            'payer_subject_id' => ['nullable', 'integer'],
            'amount' => ['nullable', 'integer', 'min:1'],
            'receiver_uid' => ['nullable', 'string', 'max:50'],
            'communication' => ['nullable', 'string', 'max:255'],
            'item_count' => ['nullable', 'integer', 'min:1', 'max:250'],
        ]);

        $itemCount = (int) ($data['item_count'] ?? 100);

        if (!empty($data['payment_transfer_id'])) {
            $transfer = PaymentTransfer::with('items')->find($data['payment_transfer_id']);

            if (!$transfer) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Payment transfer not found.',
                ], 404);
            }

            $inspection = $this->paymentVerificationService
                ->inspectTransferForUserContext($user, $transfer);

            return response()->json([
                'ok' => true,
                'mode' => 'transfer',
                'target_user' => [
                    'id' => $user->id,
                    'swc_handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                ],
                'transfer' => [
                    'id' => $transfer->id,
                    'reference' => $transfer->reference,
                    'payer_subject_type' => $transfer->payer_subject_type,
                    'payer_subject_id' => $transfer->payer_subject_id,
                    'payee_swc_uid' => $transfer->payee_swc_uid,
                    'payee_handle' => $transfer->payee_handle,
                    'total_amount' => $transfer->total_amount,
                    'communication' => $transfer->communication,
                    'status' => $transfer->status,
                ],
                'inspection' => $inspection,
            ]);
        }

        if (
            empty($data['payer_subject_type']) ||
            empty($data['payer_subject_id']) ||
            empty($data['amount'])
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Provide either payment_transfer_id or manual test fields: payer_subject_type, payer_subject_id, amount.',
            ], 422);
        }

        $inspection = $this->paymentVerificationService->inspectExpectedPaymentForUserContext(
            $user,
            payerSubjectType: (string) $data['payer_subject_type'],
            payerSubjectId: (int) $data['payer_subject_id'],
            expectedAmount: (int) $data['amount'],
            expectedReceiverUid: (string) ($data['receiver_uid'] ?? ''),
            expectedCommunication: (string) ($data['communication'] ?? ''),
            itemCount: $itemCount,
            transferReference: null,
        );

        return response()->json([
            'ok' => true,
            'mode' => 'manual',
            'target_user' => [
                'id' => $user->id,
                'swc_handle' => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
            ],
            'inspection' => $inspection,
        ]);
    }
}