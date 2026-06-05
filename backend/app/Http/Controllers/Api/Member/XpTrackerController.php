<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\Swc\SwcAuthorization;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcHttp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class XpTrackerController extends Controller
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function fetch(Request $request): JsonResponse
    {
        $user = $request->user();

        // Prefer the dedicated events context, but fall back to any auth with character_events scope
        $auth = SwcAuthorization::query()
            ->where('user_id', $user->id)
            ->where('has_personal_events_access', true)
            ->whereNotNull('access_token_encrypted')
            ->orderByRaw("CASE WHEN auth_context = ? THEN 0 ELSE 1 END", [SwcAuthorization::CONTEXT_EVENTS])
            ->first();

        if (!$auth) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC events authorization found. Please connect your SWC account.',
            ], 422);
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken($user, $auth->auth_context);

        if (!$accessToken) {
            return response()->json([
                'ok' => false,
                'message' => 'SWC events token expired or unavailable. Please reconnect.',
            ], 422);
        }

        $url = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/') . '/events/personal/xp/';
        $itemCount = 1000;
        $maxPages = 50;
        $events = [];
        $totalSeen = 0;

        for ($page = 0; $page < $maxPages; $page++) {
            $query = [
                'start_index' => (string) ($page * $itemCount),
                'item_count'  => (string) $itemCount,
            ];

            $attempt = SwcHttp::getWithOrderedAuthFallback($url, $query, $accessToken, ['oauth', 'bearer']);
            $response = $attempt['response'];

            if (!$response->ok()) {
                break;
            }

            $json = $response->json();
            $batch = data_get($json, 'swcapi.events.event', []);
            if (!is_array($batch)) {
                break;
            }

            $totalSeen += count($batch);

            foreach ($batch as $event) {
                $parsed = $this->parseEvent($event);
                if ($parsed) {
                    $events[] = $parsed;
                }
            }

            if (count($batch) < $itemCount) {
                break;
            }
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'events'      => $events,
                'total_seen'  => $totalSeen,
            ],
        ]);
    }

    private function parseEvent(array $event): ?array
    {
        $uid       = (string) data_get($event, 'attributes.uid', '');
        $timestamp = (int) data_get($event, 'time.timestamp', 0);
        $rawText   = (string) data_get($event, 'text', '');
        $text      = html_entity_decode(strip_tags($rawText), ENT_QUOTES | ENT_HTML5);

        if ($text === '' || $timestamp === 0) {
            return null;
        }

        // XP gain: "You gained N XP with the following message: ..."
        if (preg_match('/You gained (\d+) XP with the following message:\s*(.*)/i', $text, $m)) {
            $amount  = (int) $m[1];
            $message = trim($m[2]);
            return [
                'uid'       => $uid,
                'timestamp' => $timestamp,
                'type'      => 'xp_gain',
                'amount'    => $amount,
                'category'  => $this->categorizeMessage($message),
                'message'   => $message,
            ];
        }

        // Skill upgrade: "You have upgraded your X skill to N for N points."
        if (preg_match('/You have upgraded your (.+?) skill to (\d+) for (\d+) points/i', $text, $m)) {
            return [
                'uid'        => $uid,
                'timestamp'  => $timestamp,
                'type'       => 'skill_upgrade',
                'skill_name' => trim($m[1]),
                'level'      => (int) $m[2],
                'points'     => (int) $m[3],
                'amount'     => 0,
                'category'   => 'skill_upgrade',
                'message'    => $text,
            ];
        }

        // Level up: "You reached level N..."
        if (preg_match('/You reached level (\d+)/i', $text, $m)) {
            return [
                'uid'       => $uid,
                'timestamp' => $timestamp,
                'type'      => 'level_up',
                'level'     => (int) $m[1],
                'amount'    => 0,
                'category'  => 'level_up',
                'message'   => $text,
            ];
        }

        return null;
    }

    private function categorizeMessage(string $message): string
    {
        $lower = strtolower($message);

        if (
            str_contains($lower, 'sublight travel') ||
            str_contains($lower, 'hyperspace') ||
            str_contains($lower, 'hyperlane') ||
            str_contains($lower, 'aborted travelling') ||
            str_contains($lower, 'crossing terrain') ||
            str_contains($lower, 'travelling along the ground') ||
            str_contains($lower, 'travelling in city') ||
            str_contains($lower, 'ascending to orbit') ||
            str_contains($lower, 'ascending to the atmosphere') ||
            str_contains($lower, 'descending to the ground') ||
            str_contains($lower, 'descending to the atmosphere')
        ) {
            return 'travel';
        }
        if (str_contains($lower, 'recycling') || str_contains($lower, 'recycled')) {
            return 'recycling';
        }
        if (str_contains($lower, 'production') || str_contains($lower, 'produced') || str_contains($lower, 'manufactured')) {
            return 'production';
        }
        if (str_contains($lower, 'combat') || str_contains($lower, 'kill') || str_contains($lower, 'defeated') || str_contains($lower, 'destroyed')) {
            return 'combat';
        }
        if (str_contains($lower, 'mining') || str_contains($lower, 'mined')) {
            return 'mining';
        }
        if (str_contains($lower, 'trading') || str_contains($lower, 'sold') || str_contains($lower, 'bought')) {
            return 'trading';
        }

        return 'other';
    }
}
