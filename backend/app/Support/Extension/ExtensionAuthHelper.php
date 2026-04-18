<?php

declare(strict_types=1);

namespace App\Support\Extension;

use Illuminate\Contracts\Auth\Authenticatable;
use App\Support\Swc\Auth\Permissions;

final class ExtensionAuthHelper
{
    /**
     * @var array<string, array<int, string>>
     */
    private const ACTION_FLAGS = [
        'stamp' => ['can_access_wrecking_helper_extension'],
        'countback' => ['can_access_wrecking_helper_extension'],
        'recycle' => ['can_access_wrecking_helper_extension'],
    ];

    /**
     * @return array{
     *   allowed: bool,
     *   reason: string,
     *   required_flags?: array<int, string>,
     *   missing_flags?: array<int, string>
     * }
     */
    public static function canUseExtensionAction(?Authenticatable $user, string $action): array
    {
        $normalizedAction = trim(strtolower($action));

        if ($normalizedAction === '' || !array_key_exists($normalizedAction, self::ACTION_FLAGS)) {
            return [
                'allowed' => false,
                'reason' => 'Unknown extension action.',
            ];
        }

        $requiredFlags = self::ACTION_FLAGS[$normalizedAction];
        $allowed = Permissions::hasAny($user, $requiredFlags, true);

        if ($allowed) {
            return [
                'allowed' => true,
                'reason' => 'Authorized.',
                'required_flags' => $requiredFlags,
            ];
        }

        $missingFlags = [];
        foreach ($requiredFlags as $flag) {
            if (!Permissions::hasFlag($user, $flag, true)) {
                $missingFlags[] = $flag;
            }
        }

        return [
            'allowed' => false,
            'reason' => 'Missing required extension permission.',
            'required_flags' => $requiredFlags,
            'missing_flags' => $missingFlags,
        ];
    }
}
