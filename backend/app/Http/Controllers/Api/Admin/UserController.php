<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->orderByRaw('COALESCE(swc_handle, "") asc')
            ->get([
                'id',
                'swc_handle',
                'swc_character_id',
                'swc_avatar_url',
                'is_joe_member',
                'is_admin',
                'is_sysadmin',
                'is_intel',
                'is_garry',
                'is_raid',
                'can_manage_blog',
                'can_manage_tips',
                'can_manage_eotm',
            ])
            ->map(function (User $user) {
                return [
                    'id'               => $user->id,
                    'handle'           => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                    'swc_avatar_url'   => $user->swc_avatar_url,
                    'is_joe_member'    => (bool) $user->is_joe_member,
                    'is_admin'         => (bool) $user->is_admin,
                    'is_sysadmin'      => (bool) $user->is_sysadmin,
                    'is_intel'         => (bool) $user->is_intel,
                    'is_garry'         => (bool) $user->is_garry,
                    'is_raid'          => (bool) $user->is_raid,
                    'can_manage_blog'  => (bool) $user->can_manage_blog,
                    'can_manage_tips'  => (bool) $user->can_manage_tips,
                    'can_manage_eotm'  => (bool) $user->can_manage_eotm,
                ];
            })
            ->values();

        return response()->json([
            'ok' => true,
            'users' => $users,
        ]);
    }

    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        $validated = $request->validate([
            'is_admin'        => ['sometimes', 'boolean'],
            'can_manage_blog' => ['sometimes', 'boolean'],
            'can_manage_tips' => ['sometimes', 'boolean'],
            'can_manage_eotm' => ['sometimes', 'boolean'],
        ]);

        if (
            $actor &&
            $actor->id === $user->id &&
            array_key_exists('is_admin', $validated) &&
            !$validated['is_admin']
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'You cannot remove your own admin access.',
            ], 422);
        }

        $beforeAll = [
            'is_admin'        => (bool) $user->is_admin,
            'can_manage_blog' => (bool) $user->can_manage_blog,
            'can_manage_tips' => (bool) $user->can_manage_tips,
            'can_manage_eotm' => (bool) $user->can_manage_eotm,
        ];

        if (array_key_exists('is_admin', $validated)) {
            $user->is_admin = (bool) $validated['is_admin'];
        }

        if (array_key_exists('can_manage_blog', $validated)) {
            $user->can_manage_blog = (bool) $validated['can_manage_blog'];
        }

        if (array_key_exists('can_manage_tips', $validated)) {
            $user->can_manage_tips = (bool) $validated['can_manage_tips'];
        }

        if (array_key_exists('can_manage_eotm', $validated)) {
            $user->can_manage_eotm = (bool) $validated['can_manage_eotm'];
        }

        $user->save();
        $user->refresh();

        $afterAll = [
            'is_admin'        => (bool) $user->is_admin,
            'can_manage_blog' => (bool) $user->can_manage_blog,
            'can_manage_tips' => (bool) $user->can_manage_tips,
            'can_manage_eotm' => (bool) $user->can_manage_eotm,
        ];

        $before = [];
        $after = [];

        foreach ($afterAll as $key => $value) {
            if (($beforeAll[$key] ?? null) !== $value) {
                $before[$key] = $beforeAll[$key] ?? null;
                $after[$key] = $value;
            }
        }

        if ($after !== []) {
            AdminActionLogger::log(
                $request,
                'users',
                'update_permissions',
                'Updated user permissions for ' . ($user->swc_handle ?: ('user #' . $user->id)),
                'user',
                $user->id,
                $before,
                $after
            );
        }

        return response()->json([
            'ok' => true,
            'user' => [
                'id'               => $user->id,
                'handle'           => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
                'swc_avatar_url'   => $user->swc_avatar_url,
                'is_joe_member'    => (bool) $user->is_joe_member,
                'is_admin'         => (bool) $user->is_admin,
                'is_sysadmin'      => (bool) $user->is_sysadmin,
                'is_intel'         => (bool) $user->is_intel,
                'is_garry'         => (bool) $user->is_garry,
                'is_raid'          => (bool) $user->is_raid,
                'can_manage_blog'  => (bool) $user->can_manage_blog,
                'can_manage_tips'  => (bool) $user->can_manage_tips,
                'can_manage_eotm'  => (bool) $user->can_manage_eotm,
            ],
        ]);
    }
}
