<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DroidBrainPaymentSetting;
use App\Models\Faction;
use App\Models\PaymentItem;
use App\Models\PaymentTransfer;
use App\Support\Factions\FactionPermissionService;
use App\Support\Payments\BulkPaymentExportService;
use App\Support\Payments\PaymentTransferBuilder;
use App\Support\Payments\PaymentVerificationService;
use App\Support\Payments\SwcPaymentUrlBuilder;
use App\Support\Payments\ManualPaymentTemplateService;
use App\Support\Swc\SwcAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentTransferBuilder $transferBuilder,
        protected SwcPaymentUrlBuilder $urlBuilder,
        protected BulkPaymentExportService $bulkExportService,
        protected SwcAuthorizationService $swcAuthorizationService,
        protected FactionPermissionService $factionPermissionService,
        protected PaymentVerificationService $paymentVerificationService,
        protected ManualPaymentTemplateService $manualPaymentTemplateService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->manualPaymentTemplateService->generatePaymentsForDueTemplates();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $factionIds = $this->factionPermissionService
            ->getPayableFactions($user)
            ->pluck('id');

        $items = PaymentItem::query()
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
            ->orderBy('payee_handle')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $items,
        ]);
    }

    public function owedToMe(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $items = PaymentItem::query()
            ->where('payee_subject_type', 'user')
            ->where('payee_subject_id', $user->id)
            ->latest()
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $items,
        ]);
    }

    public function transfers(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $factionIds = $this->factionPermissionService
            ->getPayableFactions($user)
            ->pluck('id');

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
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $transfers,
        ]);
    }

    public function unverifiedSupportQueue(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!(bool) $user->is_sysadmin) {
            return response()->json([
                'message' => 'Only sysadmins can view the unverified payment queue.',
            ], 403);
        }

        $transfers = PaymentTransfer::query()
            ->whereNotIn('status', ['verified', 'paid'])
            ->with('items')
            ->latest()
            ->limit(500)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $transfers,
        ]);
    }

    public function buildSingle(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'payment_item_ids' => ['required', 'array', 'min:1'],
            'payment_item_ids.*' => ['integer'],
        ]);

        $items = PaymentItem::query()
            ->whereIn('id', $data['payment_item_ids'])
            ->where('status', 'pending')
            ->get();

        if ($items->isEmpty()) {
            return response()->json([
                'message' => 'No pending payment items were found.',
            ], 404);
        }

        $distinctPayers = $items
            ->map(fn (PaymentItem $item) => $item->payer_subject_type . ':' . ($item->payer_subject_id ?? ''))
            ->unique();

        if ($distinctPayers->count() !== 1) {
            return response()->json([
                'message' => 'Selected payment items must share the same payer context.',
            ], 422);
        }

        $payerType = $items->first()->payer_subject_type;

        if ($payerType === 'faction') {
            $payerFactionId = (int) $items->first()->payer_subject_id;

            if (!$this->factionPermissionService->canPayFromFaction($user, $payerFactionId)) {
                return response()->json([
                    'message' => 'You are not allowed to pay as this faction.',
                ], 403);
            }
        }

        $transfers = $this->transferBuilder->createGroupedTransfers($items, 'single_link');

        if ($transfers->count() !== 1) {
            return response()->json([
                'message' => 'Single payment must target exactly one recipient group.',
            ], 422);
        }

        $transfer = $transfers->first();
        $transfer->update([
            'status' => 'opened',
            'opened_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'data' => [
                'transfer' => $transfer->fresh('items'),
                'url' => $this->urlBuilder->buildSingleTransferUrl($transfer),
            ],
        ]);
    }

    public function buildBulk(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'payment_item_ids' => ['required', 'array', 'min:1'],
            'payment_item_ids.*' => ['integer'],
        ]);

        $items = PaymentItem::query()
            ->whereIn('id', $data['payment_item_ids'])
            ->where('status', 'pending')
            ->get();

        if ($items->isEmpty()) {
            return response()->json([
                'message' => 'No pending payment items were found.',
            ], 404);
        }

        $distinctPayers = $items
            ->map(fn (PaymentItem $item) => $item->payer_subject_type . ':' . ($item->payer_subject_id ?? ''))
            ->unique();

        if ($distinctPayers->count() !== 1) {
            return response()->json([
                'message' => 'Selected payment items must share the same payer context.',
            ], 422);
        }

        $payerType = $items->first()->payer_subject_type;

        if ($payerType === 'faction') {
            $payerFactionId = (int) $items->first()->payer_subject_id;

            if (!$this->factionPermissionService->canPayFromFaction($user, $payerFactionId)) {
                return response()->json([
                    'message' => 'You are not allowed to pay as this faction.',
                ], 403);
            }
        }

        $transfers = $this->transferBuilder->createGroupedTransfers($items, 'bulk_copy');

        foreach ($transfers as $transfer) {
            $transfer->update([
                'status' => 'opened',
                'opened_at' => now(),
            ]);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'transfers' => $transfers,
                'bulk_page_url' => $transfers->isNotEmpty()
                    ? $this->urlBuilder->buildBulkPageUrl($transfers->first())
                    : null,
                'pipe_lines' => $this->bulkExportService->toPipeLines($transfers),
            ],
        ]);
    }

    public function droidBrainSettings(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!(bool) $user->is_sysadmin) {
            return response()->json(['message' => 'Only sysadmins can manage DroidBrain payment settings.'], 403);
        }

        $settings = DroidBrainPaymentSetting::query()->latest('id')->first();
        $factions = Faction::query()
            ->orderBy('name')
            ->get(['id', 'name', 'swc_uid', 'abbreviation'])
            ->map(fn (Faction $faction) => [
                'id' => $faction->id,
                'name' => $faction->name,
                'swc_uid' => $faction->swc_uid,
                'abbreviation' => $faction->abbreviation,
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'data' => [
                'settings' => [
                    'default_payer_faction_id' => $settings?->default_payer_faction_id,
                ],
                'payer_options' => $factions,
            ],
        ]);
    }

    public function updateDroidBrainSettings(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!(bool) $user->is_sysadmin) {
            return response()->json(['message' => 'Only sysadmins can manage DroidBrain payment settings.'], 403);
        }

        $validated = $request->validate([
            'default_payer_faction_id' => ['nullable', 'integer', 'exists:factions,id'],
        ]);

        $settings = DroidBrainPaymentSetting::query()->latest('id')->first();
        if (!$settings) {
            $settings = new DroidBrainPaymentSetting();
        }

        $settings->default_payer_faction_id = $validated['default_payer_faction_id'] ?? null;
        $settings->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'default_payer_faction_id' => $settings->default_payer_faction_id,
            ],
        ]);
    }

    public function verify(Request $request, PaymentTransfer $paymentTransfer): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($paymentTransfer->payer_subject_type === 'faction') {
            $payerFactionId = (int) $paymentTransfer->payer_subject_id;

            if (!$this->factionPermissionService->canPayFromFaction($user, $payerFactionId)) {
                return response()->json([
                    'message' => 'You are not allowed to verify this faction payment.',
                ], 403);
            }

            if (!$this->swcAuthorizationService->hasFactionCreditLogAccess($user)) {
                return response()->json([
                    'message' => 'Faction SWC credit log access is required.',
                ], 403);
            }
        } else {
            if (!$this->swcAuthorizationService->hasPersonalCreditLogAccess($user)) {
                return response()->json([
                    'message' => 'Personal SWC credit log access is required.',
                ], 403);
            }
        }

        $result = $this->paymentVerificationService->verifyTransferForUserContext($user, $paymentTransfer);

        return response()->json([
            'ok' => $result['ok'],
            'data' => $result,
            'transfer' => $paymentTransfer->fresh('items'),
        ], $result['ok'] ? 200 : 422);
    }

    public function manualVerify(Request $request, PaymentTransfer $paymentTransfer): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!(bool) $user->is_sysadmin) {
            return response()->json([
                'message' => 'Only sysadmins can manually verify payments.',
            ], 403);
        }

        $data = $request->validate([
            'swc_transaction_id' => ['nullable', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        if ($paymentTransfer->status === 'verified') {
            return response()->json([
                'ok' => true,
                'data' => [
                    'ok' => true,
                    'already_verified' => true,
                    'matched_transaction_id' => $paymentTransfer->verified_transaction_id,
                    'message' => 'Transfer is already verified.',
                ],
                'transfer' => $paymentTransfer->fresh('items'),
            ]);
        }

        $result = $this->paymentVerificationService->markTransferVerifiedManually(
            $paymentTransfer,
            isset($data['swc_transaction_id']) ? (int) $data['swc_transaction_id'] : null,
            isset($data['note']) ? (string) $data['note'] : null
        );

        return response()->json([
            'ok' => true,
            'data' => $result,
            'transfer' => $paymentTransfer->fresh('items'),
        ]);
    }

    public function pullCreditLog(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $payableFactionIds = $this->factionPermissionService
            ->getPayableFactions($user)
            ->pluck('id');

        $canUsePersonalLog = $this->swcAuthorizationService->hasPersonalCreditLogAccess($user);
        $canUseFactionLog = $this->swcAuthorizationService->hasFactionCreditLogAccess($user);

        if (!$canUsePersonalLog && !$canUseFactionLog) {
            return response()->json([
                'message' => 'Your SWC payments access has timed out. Please reconnect your access and try again.',
            ], 403);
        }

        $transfers = PaymentTransfer::query()
            ->whereNotIn('status', ['verified', 'paid'])
            ->where(function ($query) use ($user, $payableFactionIds, $canUsePersonalLog, $canUseFactionLog) {
                if ($canUsePersonalLog) {
                    $query->orWhere(function ($q) use ($user) {
                        $q->where('payer_subject_type', 'user')
                            ->where('payer_subject_id', $user->id);
                    });
                }

                if ($canUseFactionLog && $payableFactionIds->isNotEmpty()) {
                    $query->orWhere(function ($q) use ($payableFactionIds) {
                        $q->where('payer_subject_type', 'faction')
                            ->whereIn('payer_subject_id', $payableFactionIds);
                    });
                }
            })
            ->with('items')
            ->latest()
            ->get();

        $result = $this->paymentVerificationService->verifyTransfersForUserContext($user, $transfers, 250);

        return response()->json([
            'ok' => true,
            'data' => $result,
        ]);
    }
}
