<?php

namespace App\Support\Discord;

use App\Models\BlogPost;
use App\Models\User;
use App\Support\Swc\Auth\Permissions;
use App\Support\Swc\CombineTime;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JenPostService
{
    public function __construct(
        protected DiscordNotifier $discordNotifier
    ) {
    }

    public function createPost(User $user, array $data): BlogPost
    {
        if (!$this->canCreateForUser($user)) {
            throw ValidationException::withMessages([
                'user' => 'You do not have permission to create JEN posts.',
            ]);
        }

        $cgtCreated = CombineTime::currentCgtString();
        if (!$cgtCreated || !is_string($cgtCreated)) {
            $cgtCreated = 'CGT unavailable';
        }

        $authorUid = $this->resolveAuthorUid($user);
        $authorHandle = $this->resolveAuthorHandle($user, $authorUid);

        $post = new BlogPost([
            'title' => trim((string) ($data['title'] ?? '')),
            'body' => (string) ($data['body'] ?? ''),
            'image_path' => $data['image_path'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'author_uid' => $authorUid,
            'author_handle' => $authorHandle,
            'created_at' => now(),
            'cgt_created' => $cgtCreated,
        ]);

        $post->save();

        $this->discordNotifier->postJenCreated($post);

        return $post->fresh();
    }

    public function canCreateForUser(User $user): bool
    {
        return Permissions::hasAny($user, ['can_manage_blog', 'is_admin']);
    }

    private function resolveAuthorUid(User $user): ?string
    {
        $uid = $user->swc_character_id ?? $user->id ?? null;

        return $uid === null ? null : (string) $uid;
    }

    private function resolveAuthorHandle(User $user, ?string $authorUid): string
    {
        foreach (['swc_handle', 'handle', 'swc_name', 'name', 'username', 'character_handle', 'email'] as $field) {
            if (isset($user->$field) && is_string($user->$field) && trim($user->$field) !== '') {
                return trim($user->$field);
            }
        }

        if ($authorUid) {
            $handle = DB::table('swc_users')->where('swc_character_id', $authorUid)->value('swc_handle');
            if (is_string($handle) && trim($handle) !== '') {
                return trim($handle);
            }
        }

        return 'Unknown';
    }
}
