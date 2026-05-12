<?php

namespace App\Support\Swc;

use App\Models\SwcAuthorization;
use App\Models\User;
use Illuminate\Http\Client\Response;

class SwcSkillsToolService
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    public function fetchCharacterSkills(User $user, string $uid): array
    {
        $normalizedUid = trim($uid);

        if ($normalizedUid === '') {
            return [
                'ok' => false,
                'status' => 422,
                'message' => 'A character UID or handle is required.',
            ];
        }

        if (!$this->swcAuthorizationService->hasCharacterSkillsAccess($user)) {
            return [
                'ok' => false,
                'status' => 422,
                'message' => 'Biometrics access is missing for this member. Ask them to reconnect Chain Code Verification with Biometrics enabled.',
            ];
        }

        $accessToken = $this->swcAuthorizationService->getAccessToken($user, SwcAuthorization::CONTEXT_MEMBER_TOOLS);
        if (!$accessToken) {
            return [
                'ok' => false,
                'status' => 422,
                'message' => 'No SWC access token is available for this member. Ask them to reconnect Chain Code Verification.',
            ];
        }

        $apiBase = rtrim((string) config('swc.api_base', 'https://www.swcombine.com/ws/v2.0'), '/');
        $url = sprintf('%s/character/%s/skills/', $apiBase, rawurlencode($normalizedUid));
        $attempt = SwcHttp::getWithOrderedAuthFallback($url, [], $accessToken, ['oauth', 'bearer']);
        $response = $attempt['response'];

        if (!$response->ok()) {
            $status = (int) $response->status();

            return [
                'ok' => false,
                'status' => $status,
                'message' => $this->upstreamErrorMessage($status),
                'upstream_status' => $status,
                'upstream_body' => $this->summarizeResponseBody($response),
            ];
        }

        return [
            'ok' => true,
            'status' => 200,
            'uid' => $normalizedUid,
            'auth_mode' => (string) ($attempt['mode'] ?? 'oauth'),
            'data' => $response->json() ?? [],
        ];
    }

    protected function upstreamErrorMessage(int $status): string
    {
        return match ($status) {
            400 => 'The character identifier is invalid. Check the UID or handle and try again.',
            401, 403 => 'SWC denied this request for the member token. Ask the member to reconnect Chain Code Verification with Biometrics access.',
            404 => 'That character was not found, or SWC denied access to that profile.',
            429 => 'SWC rate limit reached. Wait a moment and try again.',
            default => 'Failed to fetch SWC character skills right now. Please try again shortly.',
        };
    }

    protected function summarizeResponseBody(Response $response): string
    {
        $body = trim($response->body());

        if ($body === '') {
            return '';
        }

        $body = preg_replace('/\s+/', ' ', $body) ?? $body;

        if (mb_strlen($body) > 220) {
            return mb_substr($body, 0, 217) . '...';
        }

        return $body;
    }
}
