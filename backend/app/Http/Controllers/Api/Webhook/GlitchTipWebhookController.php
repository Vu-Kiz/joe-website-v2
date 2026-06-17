<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Webhook;

use App\Http\Controllers\Controller;
use App\Support\Discord\DiscordNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlitchTipWebhookController extends Controller
{
    public function __construct(private readonly DiscordNotifier $notifier) {}

    public function handle(Request $request): JsonResponse
    {
        $token = config('services.glitchtip.webhook_token');

        if (!$token || $request->query('token') !== $token) {
            return response()->json(['ok' => false], 401);
        }

        $targetDiscordUserId = config('services.glitchtip.alert_discord_user_id');

        if (!$targetDiscordUserId) {
            return response()->json(['ok' => false, 'message' => 'No alert target configured.'], 500);
        }

        // GlitchTip sends Slack-compatible payload:
        // { text: "GlitchTip Alert", attachments: [{ title, title_link, text (culprit), fields }] }
        $attachments = $request->input('attachments', []);
        $first       = is_array($attachments) && count($attachments) > 0 ? $attachments[0] : [];
        $title       = (string) ($first['title'] ?? $request->input('text', 'Unknown error'));
        $culprit     = (string) ($first['text'] ?? '');
        $issueUrl    = (string) ($first['title_link'] ?? '');
        $count       = 1;

        // Extract environment from fields array if present
        $fields      = is_array($first['fields'] ?? null) ? $first['fields'] : [];
        $environment = 'unknown';
        foreach ($fields as $field) {
            if (is_array($field) && strtolower((string) ($field['title'] ?? '')) === 'environment') {
                $environment = (string) ($field['value'] ?? 'unknown');
                break;
            }
        }

        // Parse issue count from the alert text e.g. "GlitchTip Alert (5 issues)"
        if (preg_match('/\((\d+) issues?\)/i', $request->input('text', ''), $m)) {
            $count = (int) $m[1];
        }

        $this->notifier->notifyGlitchTipIssue(
            $targetDiscordUserId,
            $title,
            $culprit,
            $count,
            $issueUrl,
            $environment,
        );

        return response()->json(['ok' => true]);
    }
}
