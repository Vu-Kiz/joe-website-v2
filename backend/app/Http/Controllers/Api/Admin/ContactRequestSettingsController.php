<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\Contact\ContactRequestSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactRequestSettingsController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $before = ContactRequestSettings::meta();

        $data = $request->validate([
            'default_recipient_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id'),
            ],
        ]);

        $recipientUserId = $data['default_recipient_user_id'] ?? null;
        if ($recipientUserId !== null) {
            $recipient = User::query()
                ->whereKey($recipientUserId)
                ->whereNotNull('discord_user_id')
                ->first();

            if (!$recipient) {
                return response()->json([
                    'ok' => false,
                    'message' => 'The selected recipient must have a linked Discord account.',
                ], 422);
            }
        }

        ContactRequestSettings::setDefaultRecipientUserId($recipientUserId !== null ? (int) $recipientUserId : null);

        $after = ContactRequestSettings::meta();

        AdminActionLogger::log(
            $request,
            'discord_bot',
            'update_contact_recipient',
            $recipientUserId !== null
                ? 'Updated the default Discord recipient for website contact requests.'
                : 'Cleared the default Discord recipient for website contact requests.',
            'contact_request_settings',
            null,
            $before,
            $after
        );

        return response()->json([
            'ok' => true,
            'message' => 'Contact recipient settings updated.',
            'data' => [
                ...$after,
                'candidate_recipients' => ContactRequestSettings::candidateRecipients(),
            ],
        ]);
    }
}
