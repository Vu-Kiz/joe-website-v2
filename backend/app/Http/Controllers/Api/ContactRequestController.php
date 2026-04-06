<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Contact\ContactRequestSettings;
use App\Support\Discord\DiscordNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactRequestController extends Controller
{
    public function __construct(
        protected DiscordNotifier $discordNotifier
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'request_type' => ['required', 'in:contact,diplomacy'],
            'discord_name' => ['required', 'string', 'max:120'],
            'star_wars_handle' => ['required', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $recipient = ContactRequestSettings::getDefaultRecipient();
        if (!$recipient || !is_string($recipient->discord_user_id) || trim($recipient->discord_user_id) === '') {
            return response()->json([
                'ok' => false,
                'message' => 'No default Discord recipient is configured for contact requests yet.',
            ], 422);
        }

        $this->discordNotifier->queueContactRequest(
            trim((string) $recipient->discord_user_id),
            [
                'request_type' => $data['request_type'],
                'discord_name' => trim((string) $data['discord_name']),
                'star_wars_handle' => trim((string) $data['star_wars_handle']),
                'message' => trim((string) $data['message']),
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'Your request has been sent to JOE staff.',
        ], 201);
    }
}
