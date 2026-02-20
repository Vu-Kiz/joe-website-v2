<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class BlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 25);
        if ($limit < 1) $limit = 1;
        if ($limit > 100) $limit = 100;

        $posts = DB::table('blog_posts')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'ok' => true,
            'posts' => $posts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        // NOTE: keep this minimal for now; we’ll expand once image uploads are wired.
        $data = $request->validate([
            'title'         => ['required', 'string', 'max:255'],
            'body'          => ['required', 'string'],
            'image_url'     => ['nullable', 'string', 'max:255'],
            'author_uid'    => ['required', 'string', 'max:32'],
            'author_handle' => ['required', 'string', 'max:100'],
            'cgt_created'   => ['nullable', 'string', 'max:64'],
        ]);

        $id = DB::table('blog_posts')->insertGetId([
            'title'         => $data['title'],
            'body'          => $data['body'],
            'image_url'     => $data['image_url'] ?? null,
            'author_uid'    => $data['author_uid'],
            'author_handle' => $data['author_handle'],
            'cgt_created'   => $data['cgt_created'] ?? null,
            'created_at'    => now(),
        ]);

        $post = DB::table('blog_posts')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'post' => $post,
        ], 201);
    }
}