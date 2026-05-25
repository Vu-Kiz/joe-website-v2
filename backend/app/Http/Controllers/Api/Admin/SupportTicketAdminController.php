<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Support\SupportTicket;
use App\Models\Support\SupportTicketMessage;
use App\Models\User;
use App\Support\Discord\DiscordNotifier;
use App\Support\Support\SupportTicketSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupportTicketAdminController extends Controller
{
    public function __construct(
        protected DiscordNotifier $discordNotifier,
    ) {}

    public function getSettings(): JsonResponse
    {
        $recipient = SupportTicketSettings::getRecipient();

        return response()->json([
            'ok' => true,
            'data' => [
                'recipient' => $recipient ? [
                    'id'                  => (int) $recipient->id,
                    'swc_handle'          => $recipient->swc_handle,
                    'discord_user_id'     => $recipient->discord_user_id,
                    'discord_username'    => $recipient->discord_username,
                    'discord_global_name' => $recipient->discord_global_name,
                ] : null,
                'candidate_recipients' => SupportTicketSettings::candidateRecipients(),
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipient_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ]);

        $userId = $data['recipient_user_id'] ?? null;

        if ($userId !== null) {
            $user = User::query()->whereKey($userId)->whereNotNull('discord_user_id')->first();
            if (!$user) {
                return response()->json(['ok' => false, 'message' => 'Selected user must have a linked Discord account.'], 422);
            }
        }

        SupportTicketSettings::setRecipientUserId($userId !== null ? (int) $userId : null);

        return response()->json(['ok' => true, 'message' => 'Support ticket recipient updated.']);
    }

    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::with(['user', 'messages.user'])
            ->orderByRaw("FIELD(severity, 'tool_breaking', 'major_bug', 'minor_bug', 'visual_ui')")
            ->orderByRaw("FIELD(status, 'open', 'in_progress', 'resolved')")
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('tool_key')) {
            $query->where('tool_key', $request->input('tool_key'));
        }

        return response()->json(['ok' => true, 'data' => $query->get()]);
    }

    public function show(SupportTicket $supportTicket): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => $supportTicket->load('messages.user', 'user')]);
    }

    public function reply(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $admin = $request->user();

        SupportTicketMessage::create([
            'ticket_id' => $supportTicket->id,
            'user_id'   => $admin->id,
            'is_admin'  => true,
            'body'      => $data['body'],
        ]);

        // DM the ticket owner
        $owner = $supportTicket->user;
        if ($owner && is_string($owner->discord_user_id) && trim($owner->discord_user_id) !== '') {
            $this->discordNotifier->notifySupportTicketReply(
                $owner->discord_user_id,
                $supportTicket->id,
                $supportTicket->title,
                $admin->discord_user_id ?? 'Staff',
            );
        }

        return response()->json(['ok' => true, 'data' => $supportTicket->load('messages.user', 'user')]);
    }

    public function updateStatus(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:open,in_progress,resolved'],
        ]);

        $supportTicket->update(['status' => $data['status']]);

        return response()->json(['ok' => true, 'data' => $supportTicket->load('messages.user', 'user')]);
    }
}
