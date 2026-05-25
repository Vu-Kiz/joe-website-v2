<?php

namespace App\Models\Market;

use App\Models\Faction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketListing extends Model
{
    public const CHANNEL_FACTION_STORE = 'faction_store';
    public const CHANNEL_MEMBER = 'member';
    public const AUDIENCE_PUBLIC = 'public';
    public const AUDIENCE_JOE_MEMBERS = 'joe_members';

    public const STATUS_OPEN = 'open';
    public const STATUS_RESERVED = 'reserved';
    public const STATUS_TRANSFER_PENDING = 'transfer_pending';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'channel',
        'audience',
        'seller_type',
        'seller_id',
        'entity_type',
        'entity_uid',
        'entity_name',
        'entity_type_uid',
        'location_galx',
        'location_galy',
        'location_label',
        'price_credits',
        'quantity_total',
        'quantity_reserved',
        'quantity_sold',
        'notes',
        'status',
        'listed_by_user_id',
        'expires_at',
        'entity_image_url',
        'entity_snapshot',
        'sale_type',
        'custom_image_path',
        'custom_image_watermarked_path',
        'custom_entity_category',
        'custom_entity_uid',
        'custom_entity_name',
        'custom_entity_image_url',
        'is_unlimited',
        'image_watermarked',
        'bundle_items',
    ];

    protected $casts = [
        'price_credits' => 'integer',
        'quantity_total' => 'integer',
        'quantity_reserved' => 'integer',
        'quantity_sold' => 'integer',
        'location_galx' => 'integer',
        'location_galy' => 'integer',
        'expires_at' => 'datetime',
        'entity_snapshot' => 'array',
        'is_unlimited' => 'boolean',
        'image_watermarked' => 'boolean',
        'bundle_items' => 'array',
    ];

    public function listedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'listed_by_user_id');
    }

    public function sellerFaction(): BelongsTo
    {
        return $this->belongsTo(Faction::class, 'seller_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(MarketOrder::class, 'listing_id');
    }

    public function getQuantityAvailableAttribute(): int
    {
        return max(0, $this->quantity_total - $this->quantity_reserved - $this->quantity_sold);
    }

    public function scopeVisibleToUser(Builder $query, ?User $user): Builder
    {
        if ($user && ($user->is_admin || $user->is_sysadmin || $user->is_joe_member)) {
            return $query;
        }

        return $query->where('audience', self::AUDIENCE_PUBLIC);
    }

    public function isVisibleTo(?User $user): bool
    {
        if ($this->audience === self::AUDIENCE_PUBLIC) {
            return true;
        }

        if (!$user) {
            return false;
        }

        if ((int) $this->listed_by_user_id === (int) $user->id) {
            return true;
        }

        return (bool) ($user->is_admin || $user->is_sysadmin || $user->is_joe_member);
    }

    public function isMaterial(): bool
    {
        return strtolower($this->entity_type) === 'material';
    }

    public function isStock(): bool
    {
        return $this->sale_type === 'stock';
    }

    public function isAvailable(): bool
    {
        return $this->status === self::STATUS_OPEN && $this->quantity_available > 0;
    }
}
