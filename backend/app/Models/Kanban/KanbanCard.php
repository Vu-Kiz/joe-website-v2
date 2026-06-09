<?php

namespace App\Models\Kanban;

use App\Models\User;
use App\Models\Support\SupportTicket;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KanbanCard extends Model
{
    protected $fillable = [
        'column_id',
        'title',
        'description',
        'priority',
        'due_date',
        'created_by',
        'assigned_to',
        'ticket_id',
        'position',
    ];

    protected $casts = [
        'due_date' => 'date:Y-m-d',
    ];

    public function column(): BelongsTo
    {
        return $this->belongsTo(KanbanColumn::class, 'column_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }
}
