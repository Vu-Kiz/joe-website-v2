<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Support\Swc\CombineTime;
use App\Support\Swc\Auth\Permissions;
use App\Support\Admin\AdminActionLogger;

class BlogController extends Controller
{
    private const USERS_TABLE = 'swc_users';
    private const HANDLE_COL  = 'swc_handle';
    private const SWC_ID_COL  = 'swc_character_id';

    public function index(): JsonResponse
    {
        $posts = DB::table('blog_posts')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'ok' => true,
            'posts' => $posts,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $post = DB::table('blog_posts')->where('id', $id)->first();

        if (!$post) {
            return response()->json([
                'ok' => false,
                'message' => 'Not found',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'post' => $post,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'      => ['required', 'string', 'max:255'],
            'body'       => ['required', 'string'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_url'  => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
        }

        $cgtCreated = CombineTime::currentCgtString();
        if (!$cgtCreated || !is_string($cgtCreated)) {
            $cgtCreated = 'CGT unavailable';
        }

        $authorUid = $this->resolveAuthorUid($user);
        $authorHandle = $this->resolveAuthorHandle($user, $authorUid);

        $id = DB::table('blog_posts')->insertGetId([
            'title'         => $data['title'],
            'body'          => $data['body'],
            'image_path'    => $data['image_path'] ?? null,
            'image_url'     => $data['image_url'] ?? null,
            'author_uid'    => $authorUid,
            'author_handle' => $authorHandle,
            'cgt_created'   => $cgtCreated,
            'created_at'    => now(),
        ]);

        $post = DB::table('blog_posts')->where('id', $id)->first();

        if ($post) {
            AdminActionLogger::log(
                $request,
                'jen',
                'create',
                'Created JEN post: ' . ($post->title ?: ('#' . $post->id)),
                'blog_post',
                $post->id,
                null,
                $this->loggablePostState($post)
            );
        }

        return response()->json([
            'ok' => true,
            'post' => $post,
        ], 201);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'      => ['sometimes', 'required', 'string', 'max:255'],
            'body'       => ['sometimes', 'required', 'string'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_url'  => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
        }

        $post = DB::table('blog_posts')->where('id', $id)->first();

        if (!$post) {
            return response()->json(['ok' => false, 'message' => 'Not found'], 404);
        }

        if (!$this->canEditPost($user, $post)) {
            return response()->json([
                'ok' => false,
                'message' => 'Forbidden',
            ], 403);
        }

        $before = $this->loggablePostState($post);

        $update = [];
        foreach (['title', 'body', 'image_path', 'image_url'] as $field) {
            if (array_key_exists($field, $data)) {
                $update[$field] = $data[$field];
            }
        }

        if ($update) {
            DB::table('blog_posts')->where('id', $id)->update($update);
        }

        $fresh = DB::table('blog_posts')->where('id', $id)->first();

        if ($fresh && $before !== $this->loggablePostState($fresh)) {
            AdminActionLogger::log(
                $request,
                'jen',
                'update',
                'Updated JEN post: ' . ($fresh->title ?: ('#' . $fresh->id)),
                'blog_post',
                $fresh->id,
                $before,
                $this->loggablePostState($fresh)
            );
        }

        return response()->json([
            'ok' => true,
            'post' => $fresh,
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
        }

        $post = DB::table('blog_posts')->where('id', $id)->first();

        if (!$post) {
            return response()->json(['ok' => false, 'message' => 'Not found'], 404);
        }

        if (!$this->canEditPost($user, $post)) {
            return response()->json([
                'ok' => false,
                'message' => 'Forbidden',
            ], 403);
        }

        $before = $this->loggablePostState($post);
        $deleted = DB::table('blog_posts')->where('id', $id)->delete();

        if (!$deleted) {
            return response()->json(['ok' => false, 'message' => 'Not found'], 404);
        }

        AdminActionLogger::log(
            $request,
            'jen',
            'delete',
            'Deleted JEN post: ' . (($before['title'] ?? null) ?: ('#' . $id)),
            'blog_post',
            $id,
            $before,
            null
        );

        return response()->json(['ok' => true]);
    }

    private function canEditPost($user, object $post): bool
    {
        if (Permissions::isSysadmin($user)) {
            return true;
        }

        if ((bool) ($user->is_admin ?? false)) {
            return true;
        }

        if (!(bool) ($user->can_manage_blog ?? false)) {
            return false;
        }

        $currentUid = (string) ($this->resolveAuthorUid($user) ?? '');
        $postUid = (string) ($post->author_uid ?? '');

        return $currentUid !== '' && $postUid !== '' && hash_equals($postUid, $currentUid);
    }

    private function resolveAuthorUid($user): ?string
    {
        $uid = $user->{self::SWC_ID_COL} ?? $user->swc_character_id ?? $user->id ?? null;
        return $uid === null ? null : (string) $uid;
    }

    private function resolveAuthorHandle($user, ?string $authorUid): string
    {
        foreach (['swc_handle', 'handle', 'swc_name', 'name', 'username', 'character_handle', 'email'] as $field) {
            if (isset($user->$field) && is_string($user->$field) && trim($user->$field) !== '') {
                return trim($user->$field);
            }
        }

        if (isset($user->id) && $user->id) {
            $handle = DB::table(self::USERS_TABLE)->where('id', $user->id)->value(self::HANDLE_COL);
            if (is_string($handle) && trim($handle) !== '') {
                return trim($handle);
            }
        }

        if ($authorUid) {
            $handle = DB::table(self::USERS_TABLE)->where(self::SWC_ID_COL, $authorUid)->value(self::HANDLE_COL);
            if (is_string($handle) && trim($handle) !== '') {
                return trim($handle);
            }
        }

        return 'Unknown';
    }

    private function loggablePostState(object $post): array
    {
        return [
            'title'         => $post->title ?? null,
            'body_preview'  => $this->previewText($post->body ?? null),
            'image_path'    => $post->image_path ?? null,
            'image_url'     => $post->image_url ?? null,
            'author_uid'    => $post->author_uid ?? null,
            'author_handle' => $post->author_handle ?? null,
            'cgt_created'   => $post->cgt_created ?? null,
        ];
    }

    private function previewText(?string $value, int $limit = 180): ?string
    {
        if ($value === null) {
            return null;
        }

        $clean = trim(preg_replace('/\s+/', ' ', strip_tags($value)) ?? $value);

        if ($clean === '') {
            return null;
        }

        if (mb_strlen($clean) <= $limit) {
            return $clean;
        }

        return mb_substr($clean, 0, $limit) . '…';
    }
}