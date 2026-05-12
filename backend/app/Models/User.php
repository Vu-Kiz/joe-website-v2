<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'discord_user_id',
        'discord_username',
        'discord_global_name',
        'discord_avatar_url',
        'discord_linked_at',
        'swc_character_id',
        'swc_handle',
        'swc_avatar_url',
        'member_tool_preferences',
        'public_tool_preferences',
        'auth_version',
        'is_joe_member',
        'is_admin',
        'is_sysadmin',
        'is_intel',
        'can_view_asteroid_intel',
        'can_access_combat_calc',
        'can_access_wrecking_helper_extension',
        'can_access_fleet_commander',
        'scan_window_top_left_galx',
        'scan_window_top_left_galy',
        'scan_window_bottom_right_galx',
        'scan_window_bottom_right_galy',
        'is_garry',
        'is_raid',
    ];

    protected $casts = [
        'discord_linked_at' => 'datetime',
        'swc_character_id' => 'integer',
        'auth_version' => 'integer',
        'member_tool_preferences' => 'array',
        'public_tool_preferences' => 'array',
        'is_joe_member' => 'boolean',
        'is_admin' => 'boolean',
        'is_sysadmin' => 'boolean',
        'is_intel' => 'boolean',
        'can_view_asteroid_intel' => 'boolean',
        'can_access_combat_calc' => 'boolean',
        'can_access_wrecking_helper_extension' => 'boolean',
        'can_access_fleet_commander' => 'boolean',
        'scan_window_top_left_galx' => 'integer',
        'scan_window_top_left_galy' => 'integer',
        'scan_window_bottom_right_galx' => 'integer',
        'scan_window_bottom_right_galy' => 'integer',
        'is_garry' => 'boolean',
        'is_raid' => 'boolean',
        'has_swc_payments_access' => 'boolean',
    ];

    protected $hidden = [
        'remember_token',
    ];

    public function factions()
    {
        return $this->belongsToMany(\App\Models\Faction::class)
            ->withPivot([
                'can_view_payments',
                'can_pay_from_faction',
                'can_mark_payments_paid',
                'can_manage_jobs',
                'can_manage_manual_payments',
            ])
            ->withTimestamps();
    }

    public function swcAuthorization()
    {
        return $this->hasOne(\App\Models\SwcAuthorization::class)
            ->where('auth_context', \App\Models\SwcAuthorization::CONTEXT_PAYMENTS);
    }

    public function swcAuthorizations()
    {
        return $this->hasMany(\App\Models\SwcAuthorization::class);
    }

    public function swcAccounts()
    {
        return $this->hasMany(\App\Models\UserSwcAccount::class);
    }

    public function wreckingHelperSetting()
    {
        return $this->hasOne(\App\Models\WreckingHelperSetting::class);
    }

    public function currentSwcAccount()
    {
        return $this->hasOne(\App\Models\UserSwcAccount::class)
            ->where('is_primary', true)
            ->whereNull('unlinked_at');
    }

    public function hyperPlans()
    {
        return $this->hasMany(\App\Models\HyperPlan::class);
    }

    public function invalidateActiveSessions(): void
    {
        $this->forceFill([
            'auth_version' => ((int) $this->auth_version) + 1,
        ])->save();
    }
}
