<?php

namespace App\Http\Controllers\Api\Support;

use App\Http\Controllers\Controller;
use App\Models\Support\SupportTicket;
use App\Models\Support\SupportTicketMessage;
use App\Support\Discord\DiscordNotifier;
use App\Support\Support\SupportTicketSettings;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function __construct(
        protected DiscordNotifier $discordNotifier,
        protected ToolAccessService $toolAccessService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tickets = SupportTicket::where('user_id', $request->user()->id)
            ->with(['messages.user'])
            ->orderByRaw("FIELD(status, 'open', 'in_progress', 'resolved')")
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['ok' => true, 'data' => $tickets]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $tier = $this->toolAccessService->tierForUser($user);

        if ($tier === ToolAccessService::TIER_NONE) {
            return response()->json(['ok' => false, 'message' => 'Access denied.'], 403);
        }

        $data = $request->validate([
            'tool_key'    => ['required', 'string', 'max:64'],
            'title'       => ['required', 'string', 'max:200'],
            'severity'    => ['required', 'in:tool_breaking,major_bug,minor_bug,visual_ui'],
            'description' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::create([
            'user_id'  => $user->id,
            'tool_key' => $data['tool_key'],
            'title'    => $data['title'],
            'severity' => $data['severity'],
            'status'   => 'open',
        ]);

        SupportTicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id'   => $user->id,
            'is_admin'  => false,
            'body'      => $data['description'],
        ]);

        $this->sendNewTicketDm($ticket, $user);

        return response()->json(['ok' => true, 'data' => $ticket->load('messages.user')], 201);
    }

    public function show(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        if ($supportTicket->user_id !== $request->user()->id) {
            return response()->json(['ok' => false, 'message' => 'Not found.'], 404);
        }

        return response()->json(['ok' => true, 'data' => $supportTicket->load('messages.user')]);
    }

    public function reply(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        if ($supportTicket->user_id !== $request->user()->id) {
            return response()->json(['ok' => false, 'message' => 'Not found.'], 404);
        }

        if ($supportTicket->status === 'resolved') {
            return response()->json(['ok' => false, 'message' => 'Ticket is resolved.'], 422);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $user = $request->user();

        SupportTicketMessage::create([
            'ticket_id' => $supportTicket->id,
            'user_id'   => $user->id,
            'is_admin'  => false,
            'body'      => $data['body'],
        ]);

        $this->sendReplyDm($supportTicket, $user);

        return response()->json(['ok' => true, 'data' => $supportTicket->load('messages.user')]);
    }

    private function sendNewTicketDm(SupportTicket $ticket, \App\Models\User $raisedBy): void
    {
        $recipient = SupportTicketSettings::getRecipient();
        if (!$recipient || !is_string($recipient->discord_user_id) || trim($recipient->discord_user_id) === '') {
            return;
        }

        $this->discordNotifier->notifySupportTicketCreated(
            $recipient->discord_user_id,
            $ticket->id,
            $ticket->tool_key,
            $ticket->severity,
            $ticket->title,
            $this->displayName($raisedBy),
        );
    }

    private function sendReplyDm(SupportTicket $ticket, \App\Models\User $repliedBy): void
    {
        $recipient = SupportTicketSettings::getRecipient();
        if (!$recipient || !is_string($recipient->discord_user_id) || trim($recipient->discord_user_id) === '') {
            return;
        }

        $this->discordNotifier->notifySupportTicketReply(
            $recipient->discord_user_id,
            $ticket->id,
            $ticket->title,
            $this->displayName($repliedBy),
        );
    }

    private function displayName(\App\Models\User $user): string
    {
        if (is_string($user->swc_handle) && trim($user->swc_handle) !== '') {
            return trim($user->swc_handle);
        }

        if (is_string($user->discord_global_name) && trim($user->discord_global_name) !== '') {
            return trim($user->discord_global_name);
        }

        if (is_string($user->discord_username) && trim($user->discord_username) !== '') {
            return trim($user->discord_username);
        }

        return 'Unknown';
    }
}
