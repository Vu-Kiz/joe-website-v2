<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ManualPaymentTemplate;
use App\Models\User;
use App\Support\Factions\FactionPermissionService;
use App\Support\Swc\SwcPrivilegeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManualPaymentTemplateController extends Controller
{
    public function __construct(
        protected FactionPermissionService $factionPermissionService,
        protected SwcPrivilegeService $swcPrivilegeService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $payableFactionIds = $this->getAvailablePayerFactions($user)
            ->pluck('id');

        $templates = ManualPaymentTemplate::query()
            ->where(function ($q) use ($user, $payableFactionIds) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('payer_subject_type', 'user')
                        ->where('payer_subject_id', $user->id);
                })->orWhere(function ($q2) use ($payableFactionIds) {
                    $q2->where('payer_subject_type', 'faction')
                        ->whereIn('payer_subject_id', $payableFactionIds);
                });
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $templates,
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $users = User::query()
            ->where('is_joe_member', true)
            ->whereNotNull('swc_character_id')
            ->orderByRaw('COALESCE(swc_handle, "") asc')
            ->get([
                'id',
                'swc_handle',
                'swc_character_id',
                'swc_avatar_url',
            ])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'handle' => $u->swc_handle,
                'swc_character_id' => $u->swc_character_id,
                'swc_uid' => $u->swc_character_id ? ('1:' . $u->swc_character_id) : null,
                'avatar_url' => $u->swc_avatar_url,
            ])
            ->values();

        $allFactions = $user->factions()->get([
            'factions.id',
            'factions.name',
            'factions.swc_uid',
            'factions.abbreviation',
        ]);

        $payerOptions = collect([
            [
                'key' => 'user:' . $user->id,
                'payer_subject_type' => 'user',
                'payer_subject_id' => $user->id,
                'label' => 'Personal - ' . ($user->swc_handle ?: ('User #' . $user->id)),
                'source' => 'personal',
            ],
        ]);

        $factionPermissionDebug = $allFactions
            ->map(fn ($faction) => $this->buildFactionPayerDebug($user, $faction, false))
            ->values();

        $factionOptions = $factionPermissionDebug
            ->filter(fn (array $entry) => (bool) ($entry['allowed'] ?? false))
            ->map(fn ($faction) => [
                'key' => 'faction:' . $faction['id'],
                'payer_subject_type' => 'faction',
                'payer_subject_id' => $faction['id'],
                'label' => 'Faction - ' . $faction['name'],
                'source' => $faction['source'] ?? 'unknown',
            ]);

        return response()->json([
            'ok' => true,
            'data' => [
                'default_payee' => [
                    'id' => $user->id,
                    'handle' => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                    'swc_uid' => $user->swc_character_id ? ('1:' . $user->swc_character_id) : null,
                    'avatar_url' => $user->swc_avatar_url,
                ],
                'users' => $users,
                'payer_options' => $payerOptions->concat($factionOptions)->values(),
                'payer_debug' => [
                    [
                        'type' => 'user',
                        'id' => $user->id,
                        'name' => $user->swc_handle ?: ('User #' . $user->id),
                        'allowed' => true,
                        'source' => 'personal',
                        'message' => 'Personal payments are always available for your own user.',
                    ],
                    ...$factionPermissionDebug->all(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'payer_subject_type' => ['required', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'payee_user_id' => ['nullable', 'integer'],
            'amount' => ['required', 'integer', 'min:0'],
            'bonus_amount' => ['nullable', 'integer', 'min:0'],
            'frequency' => ['required', 'in:monthly'],
            'day_of_month' => ['required', 'integer', 'min:1', 'max:31'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date'],
            'communication_prefix' => ['nullable', 'string', 'max:180'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,paused'],
        ]);

        $payeeUserId = (int) ($validated['payee_user_id'] ?? $user->id);

        $payee = User::query()
            ->where('id', $payeeUserId)
            ->where('is_joe_member', true)
            ->whereNotNull('swc_character_id')
            ->first();

        if (!$payee) {
            return response()->json([
                'message' => 'Selected payee is not a valid internal payment user.',
            ], 422);
        }

        [$payerLabel, $payerSubjectId] = $this->resolvePayer($user, $validated['payer_subject_type'], $validated['payer_subject_id'] ?? null);

        $amount = (int) $validated['amount'];
        $bonus = (int) ($validated['bonus_amount'] ?? 0);

        $template = ManualPaymentTemplate::create([
            'name' => $validated['name'],
            'payer_subject_type' => $validated['payer_subject_type'],
            'payer_subject_id' => $payerSubjectId,
            'payer_label' => $payerLabel,

            'payee_subject_type' => 'user',
            'payee_subject_id' => $payee->id,
            'payee_swc_uid' => '1:' . $payee->swc_character_id,
            'payee_handle' => $payee->swc_handle,
            'payee_label' => $payee->swc_handle,

            'amount' => $amount,
            'bonus_amount' => $bonus,
            'total_amount' => $amount + $bonus,

            'frequency' => $validated['frequency'],
            'day_of_month' => (int) $validated['day_of_month'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'] ?? null,

            'communication_prefix' => $validated['communication_prefix'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'meta' => [
                'created_by_user_id' => $user->id,
            ],
        ]);

        return response()->json([
            'ok' => true,
            'data' => $template,
        ]);
    }

    public function update(Request $request, ManualPaymentTemplate $manualPaymentTemplate): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $this->assertUserCanManageTemplate($user, $manualPaymentTemplate);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'payer_subject_type' => ['sometimes', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'payee_user_id' => ['nullable', 'integer'],
            'amount' => ['sometimes', 'integer', 'min:0'],
            'bonus_amount' => ['sometimes', 'integer', 'min:0'],
            'frequency' => ['sometimes', 'in:monthly'],
            'day_of_month' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['nullable', 'date'],
            'communication_prefix' => ['nullable', 'string', 'max:180'],
            'notes' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,paused'],
        ]);

        if (array_key_exists('payer_subject_type', $validated)) {
            [$payerLabel, $payerSubjectId] = $this->resolvePayer(
                $user,
                $validated['payer_subject_type'],
                $validated['payer_subject_id'] ?? null
            );

            $manualPaymentTemplate->payer_subject_type = $validated['payer_subject_type'];
            $manualPaymentTemplate->payer_subject_id = $payerSubjectId;
            $manualPaymentTemplate->payer_label = $payerLabel;
        }

        if (array_key_exists('payee_user_id', $validated)) {
            $payee = User::query()
                ->where('id', (int) $validated['payee_user_id'])
                ->where('is_joe_member', true)
                ->whereNotNull('swc_character_id')
                ->first();

            if (!$payee) {
                return response()->json([
                    'message' => 'Selected payee is not a valid internal payment user.',
                ], 422);
            }

            $manualPaymentTemplate->payee_subject_type = 'user';
            $manualPaymentTemplate->payee_subject_id = $payee->id;
            $manualPaymentTemplate->payee_swc_uid = '1:' . $payee->swc_character_id;
            $manualPaymentTemplate->payee_handle = $payee->swc_handle;
            $manualPaymentTemplate->payee_label = $payee->swc_handle;
        }

        foreach ([
            'name',
            'frequency',
            'day_of_month',
            'start_date',
            'end_date',
            'communication_prefix',
            'notes',
            'status',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $manualPaymentTemplate->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('amount', $validated)) {
            $manualPaymentTemplate->amount = (int) $validated['amount'];
        }

        if (array_key_exists('bonus_amount', $validated)) {
            $manualPaymentTemplate->bonus_amount = (int) $validated['bonus_amount'];
        }

        $manualPaymentTemplate->total_amount =
            (int) $manualPaymentTemplate->amount + (int) $manualPaymentTemplate->bonus_amount;

        $manualPaymentTemplate->save();

        return response()->json([
            'ok' => true,
            'data' => $manualPaymentTemplate->fresh(),
        ]);
    }

    public function destroy(Request $request, ManualPaymentTemplate $manualPaymentTemplate): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $this->assertUserCanManageTemplate($user, $manualPaymentTemplate);

        $manualPaymentTemplate->delete();

        return response()->json([
            'ok' => true,
        ]);
    }

    public function toggle(Request $request, ManualPaymentTemplate $manualPaymentTemplate): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $this->assertUserCanManageTemplate($user, $manualPaymentTemplate);

        $manualPaymentTemplate->status = $manualPaymentTemplate->status === 'active'
            ? 'paused'
            : 'active';
        $manualPaymentTemplate->save();

        return response()->json([
            'ok' => true,
            'data' => $manualPaymentTemplate->fresh(),
        ]);
    }

    public function generate(Request $request, ManualPaymentTemplate $manualPaymentTemplate): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $this->assertUserCanManageTemplate($user, $manualPaymentTemplate);

        $manualPaymentTemplate->forceFill([
            'last_generated_period' => null,
            'status' => 'active',
        ])->save();

        $payment = app(\App\Support\Payments\ManualPaymentTemplateService::class)
            ->generatePaymentForTemplate($manualPaymentTemplate->fresh(), now(), true);

        return response()->json([
            'ok' => true,
            'data' => [
                'template' => $manualPaymentTemplate->fresh(),
                'payment_item' => $payment,
            ],
        ]);
    }

    protected function resolvePayer($user, string $payerSubjectType, ?int $payerSubjectId): array
    {
        if ($payerSubjectType === 'user') {
            if ((int) $payerSubjectId !== (int) $user->id) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'payer_subject_id' => 'You can only create personal templates for yourself.',
                ]);
            }

            return [
                $user->swc_handle ?: ('User #' . $user->id),
                $user->id,
            ];
        }

        $faction = $this->factionPermissionService
            ->getPayableFactions($user)
            ->firstWhere('id', (int) $payerSubjectId);

        if (!$faction) {
            $faction = $this->getAvailablePayerFactions($user, true)
                ->firstWhere('id', (int) $payerSubjectId);
        }

        if (!$faction) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'payer_subject_id' => 'You are not allowed to pay from that faction.',
            ]);
        }

        return [
            $faction->name,
            $faction->id,
        ];
    }

    protected function assertUserCanManageTemplate($user, ManualPaymentTemplate $template): void
    {
        if ($template->payer_subject_type === 'user' && (int) $template->payer_subject_id === (int) $user->id) {
            return;
        }

        if ($template->payer_subject_type === 'faction') {
            $allowed = $this->getAvailablePayerFactions($user)
                ->pluck('id')
                ->contains((int) $template->payer_subject_id);

            if (!$allowed) {
                $allowed = $this->getAvailablePayerFactions($user, true)
                    ->pluck('id')
                    ->contains((int) $template->payer_subject_id);
            }

            if ($allowed) {
                return;
            }
        }

        abort(403, 'You are not allowed to manage this template.');
    }

    protected function getAvailablePayerFactions(User $user, bool $refreshPrivileges = false)
    {
        $factions = $user->factions()->get([
            'factions.id',
            'factions.name',
            'factions.swc_uid',
            'factions.abbreviation',
        ]);

        if ($user->is_sysadmin) {
            return $factions->values();
        }

        return $factions
            ->filter(fn ($faction) => (bool) ($this->buildFactionPayerDebug($user, $faction, $refreshPrivileges)['allowed'] ?? false))
            ->values();
    }

    protected function buildFactionPayerDebug(User $user, $faction, bool $refreshPrivileges = false): array
    {
        $check = $this->swcPrivilegeService->checkFactionPrivilege(
            user: $user,
            faction: $faction,
            privilegeGroup: 'finance',
            privilegeName: 'send_credits',
            refresh: $refreshPrivileges
        );

        return [
            'type' => 'faction',
            'id' => $faction->id,
            'name' => $faction->name,
            'swc_uid' => $faction->swc_uid,
            'allowed' => (bool) (($check['ok'] ?? false) && ($check['allowed'] ?? false)),
            'source' => (($check['ok'] ?? false) && ($check['allowed'] ?? false)) ? 'swc' : 'denied',
            'message' => $check['message'] ?? (
                (($check['ok'] ?? false) && ($check['allowed'] ?? false))
                    ? 'Allowed by SWC finance/send_credits privilege.'
                    : 'SWC finance/send_credits privilege not granted.'
            ),
            'local_allowed' => (bool) $faction->pivot?->can_pay_from_faction,
            'swc_check' => [
                'ok' => (bool) ($check['ok'] ?? false),
                'allowed' => (bool) ($check['allowed'] ?? false),
                'status' => $check['status'] ?? null,
                'source' => $check['source'] ?? null,
                'checked_at' => $check['checked_at'] ?? null,
            ],
        ];
    }
}
