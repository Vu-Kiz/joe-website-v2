<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        $factionIds = $user->factions()
            ->wherePivot('can_view_payments', true)
            ->pluck('factions.id');

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

        $factionIds = $user->factions()
            ->wherePivot('can_view_payments', true)
            ->pluck('factions.id');

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
            if (!$this->swcAuthorizationService->hasFactionCreditLogAccess($user)) {
                return response()->json([
                    'message' => 'Faction SWC credit log access is required.',
                ], 403);
            }

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
            if (!$this->swcAuthorizationService->hasFactionCreditLogAccess($user)) {
                return response()->json([
                    'message' => 'Faction SWC credit log access is required.',
                ], 403);
            }

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
}