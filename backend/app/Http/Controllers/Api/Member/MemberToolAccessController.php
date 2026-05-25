<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Support\Members\MemberToolAccessLogger;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MemberToolAccessController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!Permissions::hasAny($user, ['is_joe_member', 'is_intel', 'is_admin', 'is_sysadmin'])) {
            return response()->json([
                'ok' => false,
                'message' => 'You do not have the required access for member tools.',
            ], 403);
        }

        $validated = $request->validate([
            'area' => [
                'required',
                'string',
                Rule::in([
                    'jobs',
                    'astrogation',
                    'entity_stats',
                    'hyper_planner',
                    'fleet_command',
                    'galactic_archive',
                    'payments',
                    'droidbrain',
                ]),
            ],
            'page_path' => ['nullable', 'string', 'max:255'],
        ]);

        $area = (string) $validated['area'];
        $pagePath = trim((string) ($validated['page_path'] ?? ''));
        $summary = sprintf(
            'Opened %s from %s',
            $this->formatArea($area),
            $pagePath !== '' ? $pagePath : 'member tools'
        );

        MemberToolAccessLogger::log(
            $request,
            $area,
            'open',
            $summary,
            200
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    private function formatArea(string $area): string
    {
        return match ($area) {
            'entity_stats' => 'Entity Stats',
            'hyper_planner' => 'Hyper Planner',
            'fleet_command' => 'Fleet Command',
            'galactic_archive' => 'Galactic Archive',
            'droidbrain' => 'DroidBrain',
            default => ucwords(str_replace('_', ' ', $area)),
        };
    }
}
