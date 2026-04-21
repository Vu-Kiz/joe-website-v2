<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiscordChannelConfig;
use App\Models\DiscordBotGuild;
use App\Models\DiscordMessageDelivery;
use App\Models\DiscordOutboxMessage;
use App\Models\MemberChangelogEntry;
use App\Models\User;
use App\Support\Discord\DiscordNotifier;
use App\Support\Discord\JenPostService;
use App\Support\Jobs\JobService;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DiscordBotController extends Controller
{
    public function __construct(
        protected JobService $jobService,
        protected JenPostService $jenPostService
    ) {
    }

    public function setChannel(Request $request, string $notificationKey): JsonResponse
    {
        $notificationKey = $this->normalizeNotificationKey($notificationKey);
        if ($notificationKey === null) {
            return response()->json([
                'ok' => false,
                'message' => 'Unsupported Discord notification key.',
            ], 422);
        }

        $data = $request->validate([
            'discord_user_id' => ['required', 'string', 'max:40'],
            'guild_id' => ['nullable', 'string', 'max:40'],
            'channel_id' => ['required', 'string', 'max:40'],
            'channel_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::query()->where('discord_user_id', $data['discord_user_id'])->first();
        if (!$user || !Permissions::isSysadmin($user)) {
            return response()->json([
                'ok' => false,
                'message' => 'Only linked sysadmins can configure Discord announcement channels.',
            ], 403);
        }

        $config = DiscordChannelConfig::query()->updateOrCreate(
            ['notification_key' => $notificationKey],
            [
                'guild_id' => $data['guild_id'] ?? null,
                'channel_id' => $data['channel_id'],
                'channel_name' => $data['channel_name'] ?? null,
                'set_by_user_id' => $user->id,
                'set_by_discord_user_id' => $user->discord_user_id,
            ]
        );

        return response()->json([
            'ok' => true,
            'data' => $config,
        ]);
    }

    public function syncState(Request $request): JsonResponse
    {
        $data = $request->validate([
            'guilds' => ['array'],
            'guilds.*.guild_id' => ['required', 'string', 'max:40'],
            'guilds.*.guild_name' => ['required', 'string', 'max:150'],
            'guilds.*.icon_url' => ['nullable', 'string', 'max:255'],
            'guilds.*.member_count' => ['nullable', 'integer', 'min:0'],
            'guilds.*.available' => ['nullable', 'boolean'],
        ]);

        $guilds = collect($data['guilds'] ?? []);
        $seenGuildIds = [];

        foreach ($guilds as $guild) {
            $seenGuildIds[] = $guild['guild_id'];

            DiscordBotGuild::query()->updateOrCreate(
                ['guild_id' => $guild['guild_id']],
                [
                    'guild_name' => $guild['guild_name'],
                    'icon_url' => $guild['icon_url'] ?? null,
                    'member_count' => $guild['member_count'] ?? null,
                    'available' => (bool) ($guild['available'] ?? true),
                    'last_seen_at' => now(),
                ]
            );
        }

        if ($seenGuildIds !== []) {
            DiscordBotGuild::query()
                ->whereNotIn('guild_id', $seenGuildIds)
                ->update([
                    'available' => false,
                ]);
        }

        return response()->json([
            'ok' => true,
            'count' => count($seenGuildIds),
        ]);
    }

    public function latestChangelogVersion(): JsonResponse
    {
        $entry = MemberChangelogEntry::query()
            ->where('is_active', true)
            ->orderByDesc('released_at')
            ->orderByDesc('id')
            ->first();

        if (!$entry) {
            return response()->json([
                'ok' => false,
                'message' => 'No changelog entries found.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'version' => (string) $entry->version,
                'released_at' => $entry->released_at?->toIso8601String(),
            ],
        ]);
    }

    public function authorizeChangelogPost(Request $request): JsonResponse
    {
        $data = $request->validate([
            'discord_user_id' => ['required', 'string', 'max:40'],
        ]);

        $user = User::query()->where('discord_user_id', $data['discord_user_id'])->first();
        $allowed = $user ? Permissions::isSysadmin($user) : false;

        if (!$allowed) {
            return response()->json([
                'ok' => false,
                'message' => 'Only linked sysadmins can post changelog announcements.',
            ], 403);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'allowed' => true,
            ],
        ]);
    }

    public function claimOutbox(Request $request): JsonResponse
    {
        $configuredKeys = DiscordChannelConfig::query()
            ->pluck('notification_key')
            ->filter(fn ($value) => is_string($value) && $value !== '')
            ->values()
            ->all();

        $configuredKeys = array_values(array_filter(
            $configuredKeys,
            fn ($value) => $value !== DiscordNotifier::KEY_CONTACT_REQUESTS
        ));

        return $this->claimOutboxForKeys($request, $configuredKeys);
    }

    public function claimDirectOutbox(Request $request): JsonResponse
    {
        return $this->claimOutboxForKeys($request, [
            DiscordNotifier::KEY_CONTACT_REQUESTS,
        ]);
    }

    protected function claimOutboxForKeys(Request $request, array $notificationKeys): JsonResponse
    {
        $limit = max(1, min(10, (int) $request->integer('limit', 5)));
        $staleBefore = Carbon::now()->subMinutes(5);

        if ($notificationKeys === []) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $messages = DB::transaction(function () use ($limit, $staleBefore, $notificationKeys) {
            $messages = DiscordOutboxMessage::query()
                ->whereIn('notification_key', $notificationKeys)
                ->where(function ($query) use ($staleBefore) {
                    $query->where('status', DiscordOutboxMessage::STATUS_PENDING)
                        ->orWhere(function ($processing) use ($staleBefore) {
                            $processing->where('status', DiscordOutboxMessage::STATUS_PROCESSING)
                                ->where(function ($stale) use ($staleBefore) {
                                    $stale->whereNull('claimed_at')
                                        ->orWhere('claimed_at', '<=', $staleBefore);
                                });
                        });
                })
                ->orderBy('created_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            if ($messages->isEmpty()) {
                return collect();
            }

            $ids = $messages->pluck('id')->all();
            DiscordOutboxMessage::query()
                ->whereIn('id', $ids)
                ->update([
                    'status' => DiscordOutboxMessage::STATUS_PROCESSING,
                    'claimed_at' => now(),
                    'attempts' => DB::raw('attempts + 1'),
                    'updated_at' => now(),
                ]);

            return DiscordOutboxMessage::query()->whereIn('id', $ids)->orderBy('created_at')->get();
        });

        if ($messages->isEmpty()) {
            return response()->json([
                'ok' => true,
                'data' => [],
            ]);
        }

        $configs = DiscordChannelConfig::query()
            ->whereIn('notification_key', $messages->pluck('notification_key')->unique()->values())
            ->get()
            ->keyBy('notification_key');

        $channelPayload = $messages
            ->filter(fn (DiscordOutboxMessage $message) => $message->notification_key !== DiscordNotifier::KEY_CONTACT_REQUESTS)
            ->filter(fn (DiscordOutboxMessage $message) => isset($configs[$message->notification_key]))
            ->map(function (DiscordOutboxMessage $message) use ($configs) {
                $config = $configs[$message->notification_key];
                $meta = is_array($message->meta) ? $message->meta : [];
                $delivery = null;

                if (
                    isset($meta['source_type'], $meta['source_id']) &&
                    is_string($meta['source_type']) &&
                    is_numeric($meta['source_id'])
                ) {
                    $delivery = DiscordMessageDelivery::query()
                        ->where('notification_key', $message->notification_key)
                        ->where('source_type', $meta['source_type'])
                        ->where('source_id', (int) $meta['source_id'])
                        ->first();
                }

                return [
                    'id' => $message->id,
                    'notification_key' => $message->notification_key,
                    'content' => $message->content,
                    'meta' => $meta,
                    'attempts' => $message->attempts,
                    'channel' => [
                        'id' => $config->channel_id,
                        'name' => $config->channel_name,
                        'guild_id' => $config->guild_id,
                    ],
                    'dm' => null,
                    'delivery' => $delivery ? [
                        'id' => $delivery->id,
                        'guild_id' => $delivery->guild_id,
                        'channel_id' => $delivery->channel_id,
                        'message_ids' => $delivery->message_ids,
                    ] : null,
                ];
            });

        $dmPayload = $messages
            ->filter(fn (DiscordOutboxMessage $message) => $message->notification_key === DiscordNotifier::KEY_CONTACT_REQUESTS)
            ->map(function (DiscordOutboxMessage $message) {
                $meta = is_array($message->meta) ? $message->meta : [];

                return [
                    'id' => $message->id,
                    'notification_key' => $message->notification_key,
                    'content' => $message->content,
                    'meta' => $meta,
                    'attempts' => $message->attempts,
                    'channel' => null,
                    'dm' => [
                        'user_id' => is_string($meta['target_discord_user_id'] ?? null)
                            ? $meta['target_discord_user_id']
                            : '',
                    ],
                    'delivery' => null,
                ];
            });

        $payload = collect(array_merge($channelPayload->all(), $dmPayload->all()))->values();

        return response()->json([
            'ok' => true,
            'data' => $payload,
        ]);
    }

    public function markDelivered(Request $request, int $messageId): JsonResponse
    {
        $message = DiscordOutboxMessage::query()->findOrFail($messageId);
        $data = $request->validate([
            'message_ids' => ['array'],
            'message_ids.*' => ['string', 'max:40'],
            'guild_id' => ['nullable', 'string', 'max:40'],
            'channel_id' => ['nullable', 'string', 'max:40'],
        ]);

        $message->update([
            'status' => DiscordOutboxMessage::STATUS_SENT,
            'sent_at' => now(),
            'error_message' => null,
        ]);

        $meta = is_array($message->meta) ? $message->meta : [];

        if (
            isset($meta['source_type'], $meta['source_id']) &&
            is_string($meta['source_type']) &&
            is_numeric($meta['source_id']) &&
            !empty($data['message_ids']) &&
            is_array($data['message_ids'])
        ) {
            DiscordMessageDelivery::query()->updateOrCreate(
                [
                    'notification_key' => $message->notification_key,
                    'source_type' => $meta['source_type'],
                    'source_id' => (int) $meta['source_id'],
                ],
                [
                    'guild_id' => $data['guild_id'] ?? null,
                    'channel_id' => $data['channel_id'] ?? '',
                    'message_ids' => array_values(array_filter($data['message_ids'], fn ($value) => is_string($value) && $value !== '')),
                    'last_sent_at' => now(),
                ]
            );
        }

        return response()->json(['ok' => true]);
    }

    public function markFailed(Request $request, int $messageId): JsonResponse
    {
        $message = DiscordOutboxMessage::query()->findOrFail($messageId);
        $data = $request->validate([
            'error_message' => ['nullable', 'string', 'max:5000'],
            'retry' => ['nullable', 'boolean'],
        ]);

        $message->update([
            'status' => (bool) ($data['retry'] ?? true)
                ? DiscordOutboxMessage::STATUS_PENDING
                : DiscordOutboxMessage::STATUS_FAILED,
            'claimed_at' => null,
            'error_message' => $data['error_message'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }

    public function createJob(Request $request): JsonResponse
    {
        $user = $this->resolveDiscordLinkedUser((string) $request->input('discord_user_id', ''));
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'No site user is linked to that Discord account.',
            ], 404);
        }

        if (!Permissions::hasAny($user, ['is_joe_member', 'is_admin'])) {
            return response()->json([
                'ok' => false,
                'message' => 'That linked user does not have access to member tools.',
            ], 403);
        }

        $data = $request->validate([
            'discord_user_id' => ['required', 'string', 'max:40'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'job_mode' => ['required', 'in:single,multi,open_ended'],
            'pay_type' => ['required', 'in:fixed,per_day_hyper'],
            'reward_amount' => ['required', 'integer', 'min:0'],
            'bonus_amount' => ['nullable', 'integer', 'min:0'],
            'bonus_reward' => ['nullable', 'string', 'max:255'],
            'bonus_note' => ['nullable', 'string', 'max:255'],
            'payer_subject_type' => ['required', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'payer_label' => ['nullable', 'string', 'max:150'],
        ]);

        $job = $this->jobService->createJob($user, $data);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ], 201);
    }

    public function createJen(Request $request): JsonResponse
    {
        $user = $this->resolveDiscordLinkedUser((string) $request->input('discord_user_id', ''));
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'No site user is linked to that Discord account.',
            ], 404);
        }

        $data = $request->validate([
            'discord_user_id' => ['required', 'string', 'max:40'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_url' => ['nullable', 'string', 'max:255'],
        ]);

        $post = $this->jenPostService->createPost($user, $data);

        return response()->json([
            'ok' => true,
            'data' => $post,
        ], 201);
    }

    private function resolveDiscordLinkedUser(string $discordUserId): ?User
    {
        if ($discordUserId === '') {
            return null;
        }

        return User::query()->where('discord_user_id', $discordUserId)->first();
    }

    private function normalizeNotificationKey(string $notificationKey): ?string
    {
        $notificationKey = trim(strtolower($notificationKey));

        return match ($notificationKey) {
            DiscordNotifier::KEY_JOBS,
            DiscordNotifier::KEY_JEN,
            DiscordNotifier::KEY_CONTACT_REQUESTS => $notificationKey,
            default => null,
        };
    }
}
