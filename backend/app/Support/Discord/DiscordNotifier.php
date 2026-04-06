<?php

namespace App\Support\Discord;

use App\Models\BlogPost;
use App\Models\DiscordOutboxMessage;
use App\Models\Job;
use Illuminate\Support\Facades\Config;

class DiscordNotifier
{
    public const KEY_JOBS = 'jobs';
    public const KEY_JEN = 'jen';
    public const KEY_CONTACT_REQUESTS = 'contact_requests';

    public function postJobCreated(Job $job): bool
    {
        $content = $this->buildJobCreatedContent($job);

        return $this->queueMessage(self::KEY_JOBS, $content, [
            'job_id' => (int) $job->id,
        ]);
    }

    public function postJenCreated(BlogPost $post): bool
    {
        $payload = $this->buildJenCreatedPayload($post);

        return $this->queueMessage(self::KEY_JEN, $payload['content'], [
            'post_id' => (int) $post->id,
            'source_type' => 'blog_post',
            'source_id' => (int) $post->id,
            'action' => 'create',
            'messages' => $payload['messages'],
        ]);
    }

    public function postJenUpdated(BlogPost $post): bool
    {
        $payload = $this->buildJenCreatedPayload($post);

        return $this->queueMessage(self::KEY_JEN, $payload['content'], [
            'post_id' => (int) $post->id,
            'source_type' => 'blog_post',
            'source_id' => (int) $post->id,
            'action' => 'update',
            'messages' => $payload['messages'],
        ]);
    }

    public function queueContactRequest(string $targetDiscordUserId, array $payload): bool
    {
        $requestType = strtolower(trim((string) ($payload['request_type'] ?? 'contact')));
        $requestType = $requestType === 'diplomacy' ? 'Diplomacy' : 'Contact';

        $discordName = trim((string) ($payload['discord_name'] ?? 'Unknown'));
        $starWarsHandle = trim((string) ($payload['star_wars_handle'] ?? 'Unknown'));
        $message = trim((string) ($payload['message'] ?? ''));

        $content = implode("\n", array_filter([
            "**New {$requestType} Request**",
            "Discord: {$discordName}",
            "Star Wars Handle: {$starWarsHandle}",
            $message !== '' ? "Message:\n{$message}" : null,
        ]));

        DiscordOutboxMessage::create([
            'notification_key' => self::KEY_CONTACT_REQUESTS,
            'status' => DiscordOutboxMessage::STATUS_PENDING,
            'content' => $content,
            'meta' => [
                'delivery_type' => 'dm',
                'request_type' => strtolower($requestType),
                'target_discord_user_id' => $targetDiscordUserId,
                'discord_name' => $discordName,
                'star_wars_handle' => $starWarsHandle,
            ],
        ]);

        return true;
    }

    public function buildJobCreatedContent(Job $job): string
    {
        $baseUrl = $this->frontendBaseUrl();
        $reward = number_format((int) $job->reward_amount) . ' cr';
        if ($job->pay_type === 'per_day_hyper') {
            $reward .= ' / day';
        }

        $modeLabel = match ($job->job_mode) {
            'multi' => 'Multi',
            'open_ended' => 'Open-ended',
            default => 'Single',
        };

        $bonusLine = '';
        if ((int) $job->bonus_amount > 0) {
            $bonusLine = "\nBonus: " . number_format((int) $job->bonus_amount) . ' cr';
            if (is_string($job->bonus_reward) && trim($job->bonus_reward) !== '') {
                $bonusLine .= ' — ' . trim($job->bonus_reward);
            } elseif (is_string($job->bonus_note) && trim($job->bonus_note) !== '') {
                $bonusLine .= ' — ' . trim($job->bonus_note);
            }
        }

        $linkPath = '/members?members_view=jobs&jobs_view=open&job_id=' . $job->id;
        $link = $baseUrl !== '' ? $baseUrl . $linkPath : $linkPath;

        return sprintf(
            "**New Job Posted** (#%d)\n**%s**\nReward: %s\nMode: %s | Payer: %s\nPosted by: %s%s\n%s",
            (int) $job->id,
            trim((string) $job->title) !== '' ? trim((string) $job->title) : 'New job',
            $reward,
            $modeLabel,
            $job->payer_label ?: 'Unknown',
            $job->created_by_handle ?: 'Unknown',
            $bonusLine,
            $link
        );
    }

    public function buildJenCreatedPayload(BlogPost $post): array
    {
        $baseUrl = $this->frontendBaseUrl();
        $linkPath = '/jen?post=' . $post->id;
        $link = $baseUrl !== '' ? $baseUrl . $linkPath : $linkPath;
        $title = trim((string) $post->title) !== '' ? trim((string) $post->title) : 'Untitled post';
        $article = $this->toDiscordArticleText((string) ($post->body ?? ''));
        $postedBy = trim((string) ($post->author_handle ?? 'Unknown')) !== '' ? trim((string) $post->author_handle) : 'Unknown';
        $imageUrl = is_string($post->image_url ?? null) && trim((string) $post->image_url) !== ''
            ? $this->normalizeAssetUrl(trim((string) $post->image_url))
            : null;

        $messages = array_values(array_filter([
            "**{$title}**",
            $imageUrl,
            trim(($article !== '' ? $article . "\n\n" : '') . "Posted by: {$postedBy}\n{$link}"),
        ], fn ($value) => is_string($value) && trim($value) !== ''));

        return [
            'content' => '',
            'messages' => $messages,
        ];
    }

    private function queueMessage(string $notificationKey, string $content, array $meta = []): bool
    {
        DiscordOutboxMessage::create([
            'notification_key' => $notificationKey,
            'status' => DiscordOutboxMessage::STATUS_PENDING,
            'content' => $content,
            'meta' => $meta,
        ]);

        return true;
    }

    private function frontendBaseUrl(): string
    {
        return rtrim(
            (string) Config::get('services.jobs_discord.frontend_url', Config::get('discord.frontend_url', '')),
            '/'
        );
    }

    private function assetBaseUrl(): string
    {
        return rtrim((string) Config::get('services.jobs_discord.asset_url', Config::get('app.url', '')), '/');
    }

    private function normalizeAssetUrl(string $url): string
    {
        if ($url === '') {
            return $url;
        }

        if (preg_match('/^https?:\/\//i', $url) === 1) {
            return $url;
        }

        $baseUrl = $this->assetBaseUrl();
        if ($baseUrl === '') {
            return $url;
        }

        $path = str_starts_with($url, '/') ? $url : '/' . ltrim($url, '/');

        return $baseUrl . $path;
    }

    private function toDiscordArticleText(string $body): string
    {
        $text = html_entity_decode($body, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $replacements = [
            '/\[b\](.*?)\[\/b\]/is' => '**$1**',
            '/\[i\](.*?)\[\/i\]/is' => '*$1*',
            // Discord underline can interact awkwardly with adjacent markdown, so keep the text plain.
            '/\[u\](.*?)\[\/u\]/is' => '$1',
            '/\[(s|strike)\](.*?)\[\/(s|strike)\]/is' => '~~$2~~',
            '/\[code\](.*?)\[\/code\]/is' => '`$1`',
            '/\[quote\](.*?)\[\/quote\]/is' => '> $1',
            '/\[url=(.*?)\](.*?)\[\/url\]/is' => '$2 ($1)',
            '/\[url\](.*?)\[\/url\]/is' => '$1',
            '/\[list\](.*?)\[\/list\]/is' => '$1',
            '/\[\*\](.*?)(?=(\[\*\]|\z))/is' => '- $1' . "\n",
            '/\[(center|left|right|size|color|font|hr)\b[^\]]*\](.*?)\[\/\1\]/is' => '$2',
        ];

        foreach ($replacements as $pattern => $replacement) {
            $text = preg_replace($pattern, $replacement, $text) ?? $text;
        }

        $text = preg_replace('/\[(\/)?[a-z*]+(?:=[^\]]+)?\]/i', '', $text) ?? $text;
        $text = preg_replace("/\r\n|\r/", "\n", $text) ?? $text;
        $text = preg_replace('/([*_~`])(?=\S)/u', '$1', $text) ?? $text;
        $text = preg_replace('/(?<=\S)([*_~`]+)/u', '$1', $text) ?? $text;
        $text = preg_replace('/(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)(?=(\*\*|\*|~~|`|[[:alnum:]]))/u', '$1 ', $text) ?? $text;
        $text = preg_replace('/(?<=[[:alnum:]\)])(\*\*|\*|~~|`)/u', ' $1', $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", trim($text)) ?? trim($text);
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/ ?\n ?/', "\n", $text) ?? $text;

        if ($text === '') {
            return '';
        }

        if (mb_strlen($text) > 350) {
            return rtrim(mb_substr($text, 0, 347)) . '...';
        }

        return $text;
    }
}
