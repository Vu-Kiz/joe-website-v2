<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuthController extends Controller
{
    public function __construct(protected ToolAccessService $toolAccessService)
    {
    }

    public function me(Request $request): JsonResponse
    {
        $authUser = Auth::user();
        $tier = $this->toolAccessService->tierForUser($authUser);
        $subscription = $authUser ? $this->toolAccessService->activeSubscriptionFor($authUser) : null;
        $storeHasActivePlans = \App\Models\ToolSubscriptionPlan::where('is_active', true)->exists();

        return response()->json([
            'ok' => true,
            'debug' => [
                'has_session_cookie' => $request->hasCookie(config('session.cookie')),
                'session_cookie_name' => config('session.cookie'),
                'session_id' => $request->session()->getId(),
                'auth_check' => Auth::check(),
            ],
            'user' => Auth::user() ? [
                'id' => Auth::user()->id,
                'discord_user_id' => Auth::user()->discord_user_id,
                'discord_username' => Auth::user()->discord_username,
                'discord_global_name' => Auth::user()->discord_global_name,
                'discord_avatar_url' => Auth::user()->discord_avatar_url,
                'swc_character_id' => Auth::user()->swc_character_id,
                'handle' => Auth::user()->swc_handle
                    ?: Auth::user()->discord_global_name
                    ?: Auth::user()->discord_username,
                'avatar_url' => Auth::user()->swc_avatar_url ?: Auth::user()->discord_avatar_url,
                'is_joe_member' => (bool) Auth::user()->is_joe_member,
                'is_admin' => (bool) Auth::user()->is_admin,
                'is_sysadmin' => (bool) Auth::user()->is_sysadmin,
                'is_intel' => (bool) Auth::user()->is_intel,
                'can_view_asteroid_intel' => (bool) Auth::user()->can_view_asteroid_intel,
                'can_access_combat_calc' => (bool) Auth::user()->can_access_combat_calc,
                'can_access_wrecking_helper_extension' => (bool) Auth::user()->can_access_wrecking_helper_extension,
                'can_access_fleet_commander' => (bool) Auth::user()->can_access_fleet_commander,
                'scan_window_top_left_galx' => Auth::user()->scan_window_top_left_galx,
                'scan_window_top_left_galy' => Auth::user()->scan_window_top_left_galy,
                'scan_window_bottom_right_galx' => Auth::user()->scan_window_bottom_right_galx,
                'scan_window_bottom_right_galy' => Auth::user()->scan_window_bottom_right_galy,
                'is_garry' => (bool) Auth::user()->is_garry,
                'is_raid' => (bool) Auth::user()->is_raid,
                'can_manage_blog' => (bool) Auth::user()->can_manage_blog,
                'force_subscriber_tier' => (bool) Auth::user()->force_subscriber_tier,
                'lock_joe_flags' => (bool) Auth::user()->lock_joe_flags,
                'tool_access_tier' => $tier,
                'store_has_active_plans' => $storeHasActivePlans,
                'tool_subscription' => $subscription ? [
                    'id' => $subscription->id,
                    'plan_key' => $subscription->plan_key,
                    'subscriber_type' => $subscription->subscriber_type,
                    'status' => $subscription->status,
                    'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                ] : null,
            ] : null,
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function sessionStream(Request $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated',
                'error_code' => 'unauthenticated',
            ], 401);
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        if (function_exists('ignore_user_abort')) {
            @ignore_user_abort(true);
        }

        $userId = (int) $user->id;
        $sessionVersion = (int) $request->session()->get('auth_version', (int) ($user->auth_version ?? 1));

        return response()->stream(function () use ($userId, $sessionVersion) {
            $send = function (string $event, array $payload = []): void {
                echo "event: {$event}\n";
                echo 'data: ' . json_encode($payload, JSON_UNESCAPED_SLASHES) . "\n\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            };

            $send('connected', [
                'ok' => true,
                'user_id' => $userId,
            ]);

            while (!connection_aborted()) {
                $freshUser = User::query()->find($userId);

                if (!$freshUser || (int) ($freshUser->auth_version ?? 1) !== $sessionVersion) {
                    $send('session_invalidated', [
                        'ok' => false,
                        'message' => 'Your session has been signed out. Please log in again.',
                        'error_code' => 'session_invalidated',
                    ]);
                    break;
                }

                $send('heartbeat', [
                    'ok' => true,
                    'time' => now()->toIso8601String(),
                ]);

                sleep(10);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
