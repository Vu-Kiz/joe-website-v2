<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MemberChangelogEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class MemberChangelogAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $entries = MemberChangelogEntry::query()
            ->orderByDesc('released_at')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get()
            ->map(fn (MemberChangelogEntry $entry): array => $this->serializeEntry($entry));

        return response()->json([
            'ok' => true,
            'data' => $entries,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'version' => ['required', 'string', 'max:20'],
            'title' => ['required', 'string', 'max:255'],
            'details' => ['required', 'string'],
            'tools' => ['nullable', 'array'],
            'tools.*' => ['string', 'max:120'],
            'audiences' => ['nullable', 'array'],
            'audiences.*' => ['string', 'max:120'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'released_at' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $version = trim((string) $validated['version']);
        $nextSortOrder = $this->nextSortOrderForVersion($version);
        $releasedAtInput = Arr::get($validated, 'released_at');
        $versionReleaseDate = $this->versionReleaseDateFor($version);
        $releasedAt = $releasedAtInput ?? $versionReleaseDate;

        $entry = MemberChangelogEntry::query()->create([
            'version' => $version,
            'title' => trim((string) $validated['title']),
            'details' => trim((string) $validated['details']),
            'tools' => $this->cleanStringList(Arr::get($validated, 'tools', [])),
            'audiences' => $this->cleanStringList(Arr::get($validated, 'audiences', ['all'])),
            'sort_order' => array_key_exists('sort_order', $validated) && $validated['sort_order'] !== null
                ? (int) $validated['sort_order']
                : $nextSortOrder,
            'released_at' => $releasedAt,
            'is_active' => (bool) Arr::get($validated, 'is_active', true),
        ]);

        if (array_key_exists('released_at', $validated)) {
            $this->applyVersionReleaseDate($version, $releasedAtInput);
        }

        return response()->json([
            'ok' => true,
            'data' => $this->serializeEntry($entry),
        ]);
    }

    public function update(Request $request, MemberChangelogEntry $memberChangelogEntry): JsonResponse
    {
        $previousVersion = (string) $memberChangelogEntry->version;

        $validated = $request->validate([
            'version' => ['sometimes', 'string', 'max:20'],
            'title' => ['sometimes', 'string', 'max:255'],
            'details' => ['sometimes', 'string'],
            'tools' => ['nullable', 'array'],
            'tools.*' => ['string', 'max:120'],
            'audiences' => ['nullable', 'array'],
            'audiences.*' => ['string', 'max:120'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'released_at' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $memberChangelogEntry->fill([
            'version' => array_key_exists('version', $validated) ? trim((string) $validated['version']) : $memberChangelogEntry->version,
            'title' => array_key_exists('title', $validated) ? trim((string) $validated['title']) : $memberChangelogEntry->title,
            'details' => array_key_exists('details', $validated) ? trim((string) $validated['details']) : $memberChangelogEntry->details,
            'sort_order' => array_key_exists('sort_order', $validated) ? (int) $validated['sort_order'] : $memberChangelogEntry->sort_order,
            'released_at' => array_key_exists('released_at', $validated) ? $validated['released_at'] : $memberChangelogEntry->released_at,
        ]);

        if (array_key_exists('tools', $validated)) {
            $memberChangelogEntry->tools = $this->cleanStringList(Arr::get($validated, 'tools', []));
        }

        if (array_key_exists('audiences', $validated)) {
            $memberChangelogEntry->audiences = $this->cleanStringList(Arr::get($validated, 'audiences', []));
        }

        if (array_key_exists('is_active', $validated)) {
            $memberChangelogEntry->is_active = (bool) $validated['is_active'];
        }

        $memberChangelogEntry->save();

        if (array_key_exists('released_at', $validated)) {
            $this->applyVersionReleaseDate((string) $memberChangelogEntry->version, Arr::get($validated, 'released_at'));
        }

        if (
            $previousVersion !== (string) $memberChangelogEntry->version
            && !array_key_exists('released_at', $validated)
        ) {
            $memberChangelogEntry->released_at = $this->versionReleaseDateFor((string) $memberChangelogEntry->version);
            $memberChangelogEntry->save();
        }

        return response()->json([
            'ok' => true,
            'data' => $this->serializeEntry($memberChangelogEntry),
        ]);
    }

    public function destroy(MemberChangelogEntry $memberChangelogEntry): JsonResponse
    {
        $memberChangelogEntry->delete();

        return response()->json([
            'ok' => true,
        ]);
    }

    public function generateFromReadme(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'replace_existing' => ['sometimes', 'boolean'],
            'markdown' => ['nullable', 'string'],
        ]);

        $replaceExisting = (bool) Arr::get($validated, 'replace_existing', false);
        $providedMarkdown = trim((string) Arr::get($validated, 'markdown', ''));
        $source = 'request';

        if ($providedMarkdown !== '') {
            $contents = $providedMarkdown;
        } else {
            $source = 'filesystem';
            $readmePath = $this->resolveReadmePath();

            if ($readmePath === null || !is_file($readmePath)) {
                return response()->json([
                    'ok' => false,
                    'message' => 'README.md was not found.',
                ], 404);
            }

            $contents = (string) file_get_contents($readmePath);
        }
        $parsed = $this->parseReadmeChangelogSections($contents);

        if ($replaceExisting) {
            MemberChangelogEntry::query()->delete();
        }

        $created = 0;
        $updated = 0;

        foreach ($parsed as $entryData) {
            $entry = MemberChangelogEntry::query()->updateOrCreate(
                [
                    'version' => $entryData['version'],
                    'title' => $entryData['title'],
                ],
                [
                    'details' => $entryData['details'],
                    'tools' => $entryData['tools'],
                    'audiences' => $entryData['audiences'],
                    'sort_order' => $entryData['sort_order'],
                    'released_at' => $entryData['released_at'],
                    'is_active' => true,
                ]
            );

            if ($entry->wasRecentlyCreated) {
                $created++;
            } else {
                $updated++;
            }
        }

        return response()->json([
            'ok' => true,
            'created' => $created,
            'updated' => $updated,
            'total' => count($parsed),
            'source' => $source,
        ]);
    }

    public function export(): JsonResponse
    {
        $entries = MemberChangelogEntry::query()
            ->orderByDesc('released_at')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get()
            ->map(fn (MemberChangelogEntry $entry): array => $this->serializeEntry($entry))
            ->values()
            ->all();

        return response()->json([
            'ok' => true,
            'exported_at' => now()->toIso8601String(),
            'count' => count($entries),
            'entries' => $entries,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'replace_existing' => ['sometimes', 'boolean'],
            'entries' => ['required', 'array'],
            'entries.*.version' => ['required', 'string', 'max:20'],
            'entries.*.title' => ['required', 'string', 'max:255'],
            'entries.*.details' => ['required', 'string'],
            'entries.*.tools' => ['nullable', 'array'],
            'entries.*.tools.*' => ['string', 'max:120'],
            'entries.*.audiences' => ['nullable', 'array'],
            'entries.*.audiences.*' => ['string', 'max:120'],
            'entries.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'entries.*.released_at' => ['nullable', 'date'],
            'entries.*.is_active' => ['sometimes', 'boolean'],
        ]);

        $replaceExisting = (bool) Arr::get($validated, 'replace_existing', false);
        $entriesInput = Arr::get($validated, 'entries', []);

        if ($replaceExisting) {
            MemberChangelogEntry::query()->delete();
        }

        $created = 0;
        $updated = 0;

        foreach ($entriesInput as $entryData) {
            $version = trim((string) Arr::get($entryData, 'version', ''));
            $title = trim((string) Arr::get($entryData, 'title', ''));
            $details = trim((string) Arr::get($entryData, 'details', ''));
            $tools = $this->cleanStringList(Arr::get($entryData, 'tools', []));
            $audiences = $this->cleanStringList(Arr::get($entryData, 'audiences', ['all']));

            $entry = MemberChangelogEntry::query()->updateOrCreate(
                [
                    'version' => $version,
                    'title' => $title,
                ],
                [
                    'details' => $details,
                    'tools' => $tools,
                    'audiences' => $audiences === [] ? ['all'] : $audiences,
                    'sort_order' => (int) Arr::get(
                        $entryData,
                        'sort_order',
                        $this->nextSortOrderForVersion($version)
                    ),
                    'released_at' => Arr::get($entryData, 'released_at') ?: null,
                    'is_active' => (bool) Arr::get($entryData, 'is_active', true),
                ]
            );

            if ($entry->wasRecentlyCreated) {
                $created += 1;
            } else {
                $updated += 1;
            }
        }

        return response()->json([
            'ok' => true,
            'created' => $created,
            'updated' => $updated,
            'total' => count($entriesInput),
            'replace_existing' => $replaceExisting,
        ]);
    }

    private function resolveReadmePath(): ?string
    {
        $candidates = [
            base_path('../README.md'),
            base_path('README.md'),
            dirname(base_path()) . '/README.md',
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * @return array<int, array{
     *   version: string,
     *   title: string,
     *   details: string,
     *   tools: array<int, string>,
     *   audiences: array<int, string>,
     *   sort_order: int,
     *   released_at: string|null
     * }>
     */
    private function parseReadmeChangelogSections(string $contents): array
    {
        $entries = [];
        $sort = 10;

        if (!preg_match_all('/^##\s+v(\d+\.\d+\.\d+)\s+(?:Patch Notes|Release Notes|Status)\s*$/mi', $contents, $matches, PREG_OFFSET_CAPTURE)) {
            return [];
        }

        $sections = $matches[0];
        foreach ($sections as $index => $sectionMatch) {
            $version = $matches[1][$index][0] ?? null;
            $start = $sectionMatch[1] + strlen($sectionMatch[0]);
            $end = isset($sections[$index + 1]) ? $sections[$index + 1][1] : strlen($contents);
            $chunk = trim(substr($contents, $start, $end - $start));

            if (!$version || $chunk === '') {
                continue;
            }

            $includedPos = stripos($chunk, 'Included updates:');
            if ($includedPos !== false) {
                $chunk = trim(substr($chunk, $includedPos + strlen('Included updates:')));
            }

            $lines = preg_split('/\R/', $chunk) ?: [];
            $currentTitle = null;
            $currentDetails = [];

            $flush = function () use (&$entries, &$currentTitle, &$currentDetails, &$sort, $version): void {
                if (!$currentTitle) {
                    return;
                }

                $details = trim(preg_replace('/\s+/', ' ', implode(' ', $currentDetails)));
                if ($details === '') {
                    $details = sprintf('%s update.', $currentTitle);
                }

                $mapping = $this->guessVisibilityFromTitleAndDetails($currentTitle, $details);

                $entries[] = [
                    'version' => $version,
                    'title' => $currentTitle,
                    'details' => $details,
                    'tools' => $mapping['tools'],
                    'audiences' => $mapping['audiences'],
                    'sort_order' => $sort,
                    'released_at' => null,
                ];

                $sort += 1;
                $currentTitle = null;
                $currentDetails = [];
            };

            foreach ($lines as $line) {
                $trimmed = trim($line);
                if ($trimmed === '') {
                    continue;
                }

                if (preg_match('/^- (.+)$/', $trimmed, $bulletMatch)) {
                    $flush();
                    $currentTitle = trim((string) $bulletMatch[1]);
                    $currentDetails = [];
                    continue;
                }

                if ($currentTitle) {
                    $currentDetails[] = $trimmed;
                }
            }

            $flush();
        }

        return $entries;
    }

    /**
     * @return array{tools: array<int, string>, audiences: array<int, string>}
     */
    private function guessVisibilityFromTitleAndDetails(string $title, string $details): array
    {
        $text = Str::lower($title . ' ' . $details);
        $tools = [];
        $audiences = [];

        $map = [
            ['needle' => 'wrecking helper', 'tool' => 'Wrecking Helper', 'audience' => 'wreckingHelper'],
            ['needle' => 'combat calculator', 'tool' => 'Combat Calculator', 'audience' => 'combatCalc'],
            ['needle' => 'targeting heatmap', 'tool' => 'Targeting Heatmap', 'audience' => 'combatCalc'],
            ['needle' => 'entity stats', 'tool' => 'Entity Stats', 'audience' => 'members'],
            ['needle' => 'astrogation', 'tool' => 'Astrogation', 'audience' => 'members'],
            ['needle' => 'droidbrain', 'tool' => 'DroidBrain', 'audience' => 'droidbrain'],
            ['needle' => 'payments', 'tool' => 'Payments', 'audience' => 'payments'],
            ['needle' => 'jen editor', 'tool' => 'JEN', 'audience' => 'jenEditor'],
            ['needle' => 'jen post', 'tool' => 'JEN', 'audience' => 'jenEditor'],
            ['needle' => 'jen ', 'tool' => 'JEN', 'audience' => 'jenEditor'],
            ['needle' => 'blog', 'tool' => 'JEN', 'audience' => 'jenEditor'],
            ['needle' => 'jobs', 'tool' => 'Jobs', 'audience' => 'members'],
            ['needle' => 'hyper planner', 'tool' => 'Hyper Planner', 'audience' => 'members'],
            ['needle' => 'galactic archive', 'tool' => 'Galactic Archive', 'audience' => 'members'],
            ['needle' => 'asteroid intel', 'tool' => 'Astrogation', 'audience' => 'asteroidIntel'],
            ['needle' => 'sysadmin', 'tool' => 'Admin', 'audience' => 'sysadmin'],
            ['needle' => 'admin', 'tool' => 'Admin', 'audience' => 'admin'],
        ];

        foreach ($map as $rule) {
            if (str_contains($text, $rule['needle'])) {
                $tools[] = $rule['tool'];
                $audiences[] = $rule['audience'];
            }
        }

        if ($tools === []) {
            $tools[] = 'Members Tools';
        }

        if ($audiences === []) {
            $audiences[] = 'all';
        }

        return [
            'tools' => array_values(array_unique($tools)),
            'audiences' => array_values(array_unique($audiences)),
        ];
    }

    /**
     * @param array<int, mixed> $values
     * @return array<int, string>
     */
    private function cleanStringList(array $values): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            $values
        ), static fn (string $value): bool => $value !== '')));
    }

    private function nextSortOrderForVersion(string $version): int
    {
        $maxSort = MemberChangelogEntry::query()
            ->where('version', $version)
            ->max('sort_order');

        if (!is_numeric($maxSort)) {
            return 1;
        }

        return ((int) $maxSort) + 1;
    }

    private function versionReleaseDateFor(string $version): mixed
    {
        return MemberChangelogEntry::query()
            ->where('version', $version)
            ->whereNotNull('released_at')
            ->orderByDesc('released_at')
            ->value('released_at');
    }

    private function applyVersionReleaseDate(string $version, mixed $releasedAt): void
    {
        MemberChangelogEntry::query()
            ->where('version', $version)
            ->update(['released_at' => $releasedAt]);
    }

    private function serializeEntry(MemberChangelogEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'version' => (string) $entry->version,
            'title' => (string) $entry->title,
            'details' => (string) $entry->details,
            'tools' => array_values(array_filter($entry->tools ?? [], fn ($value): bool => is_string($value) && trim($value) !== '')),
            'audiences' => array_values(array_filter($entry->audiences ?? [], fn ($value): bool => is_string($value) && trim($value) !== '')),
            'sort_order' => (int) $entry->sort_order,
            'released_at' => $entry->released_at?->toIso8601String(),
            'is_active' => (bool) $entry->is_active,
            'updated_at' => $entry->updated_at?->toIso8601String(),
        ];
    }
}
