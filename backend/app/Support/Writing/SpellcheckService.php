<?php

namespace App\Support\Writing;

use Illuminate\Support\Facades\Http;

class SpellcheckService
{
    public function check(string $text, ?string $language = null, ?callable $transform = null): array
    {
        $text = trim($text);
        if ($text === '') {
            return [];
        }

        $response = Http::asForm()
            ->acceptJson()
            ->timeout(15)
            ->post((string) config('services.languagetool.url'), [
                'text' => $text,
                'language' => $language ?: (string) config('services.languagetool.language', 'en-US'),
            ]);

        if (!$response->ok()) {
            throw new \RuntimeException('Spellcheck request failed (HTTP ' . $response->status() . ').');
        }

        $matches = $response->json('matches');

        if (!is_array($matches)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($match) use ($transform) {
            if (!is_array($match)) {
                return null;
            }

            $replacements = array_values(array_filter(array_map(
                fn ($replacement) => is_array($replacement) ? trim((string) ($replacement['value'] ?? '')) : null,
                $match['replacements'] ?? []
            )));

            $entry = [
                'message' => trim((string) ($match['message'] ?? 'Possible spelling issue')),
                'short_message' => trim((string) ($match['shortMessage'] ?? '')) ?: null,
                'offset' => isset($match['offset']) ? (int) $match['offset'] : null,
                'length' => isset($match['length']) ? (int) $match['length'] : null,
                'context_text' => trim((string) ($match['context']['text'] ?? '')) ?: null,
                'context_offset' => isset($match['context']['offset']) ? (int) $match['context']['offset'] : null,
                'context_length' => isset($match['context']['length']) ? (int) $match['context']['length'] : null,
                'sentence' => trim((string) ($match['sentence'] ?? '')) ?: null,
                'rule_id' => trim((string) ($match['rule']['id'] ?? '')) ?: null,
                'rule_category' => trim((string) ($match['rule']['category']['name'] ?? '')) ?: null,
                'replacements' => array_slice($replacements, 0, 6),
            ];

            if ($transform) {
                $entry = $transform($entry, $match) ?? $entry;
            }

            return $entry;
        }, $matches)));
    }

    public function normalizeJenBodyData(string $body): array
    {
        $raw = html_entity_decode($body, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = '';
        $map = [];
        $length = strlen($raw);
        $i = 0;

        while ($i < $length) {
            $char = $raw[$i];

            if ($char === '[') {
                $end = strpos($raw, ']', $i);
                if ($end !== false) {
                    $tag = substr($raw, $i, $end - $i + 1);
                    if (preg_match('/^\[hr\]$/i', $tag) === 1) {
                        $text .= "\n";
                        $map[] = $i;
                    }
                    $i = $end + 1;
                    continue;
                }
            }

            if ($char === "\r") {
                $i += 1;
                continue;
            }

            $text .= $char;
            $map[] = $i;
            $i += 1;
        }

        $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/ ?\n ?/', "\n", $text) ?? $text;
        $text = trim($text);

        return [
            'text' => $text,
            'raw' => $raw,
            'offset_map' => $map,
        ];
    }

    public function normalizeJenBody(string $body): string
    {
        return (string) ($this->normalizeJenBodyData($body)['text'] ?? '');
    }
}
