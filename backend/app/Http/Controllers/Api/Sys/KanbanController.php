<?php

namespace App\Http\Controllers\Api\Sys;

use App\Http\Controllers\Controller;
use App\Models\Kanban\KanbanCard;
use App\Models\Kanban\KanbanColumn;
use App\Models\Support\SupportTicket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KanbanController extends Controller
{
    // GET /sys/kanban/assignees
    public function assignees(): JsonResponse
    {
        $users = User::where('is_sysadmin', true)
            ->select('id', 'swc_handle')
            ->orderBy('swc_handle')
            ->get();

        return response()->json(['ok' => true, 'data' => $users]);
    }

    // GET /sys/kanban
    public function index(): JsonResponse
    {
        $columns = KanbanColumn::orderBy('position')
            ->with(['cards' => function ($q) {
                $q->orderBy('position')
                  ->with(['creator:id,swc_handle', 'assignee:id,swc_handle', 'ticket:id,title']);
            }])
            ->get();

        return response()->json(['ok' => true, 'data' => $columns]);
    }

    // POST /sys/kanban/columns
    public function storeColumn(Request $request): JsonResponse
    {
        $data = $request->validate(['title' => 'required|string|max:100']);

        $maxPos = KanbanColumn::max('position') ?? -1;
        $column = KanbanColumn::create(['title' => $data['title'], 'position' => $maxPos + 1]);

        return response()->json(['ok' => true, 'data' => $column], 201);
    }

    // PATCH /sys/kanban/columns/{column}
    public function updateColumn(Request $request, KanbanColumn $column): JsonResponse
    {
        $data = $request->validate(['title' => 'sometimes|string|max:100']);
        $column->update($data);

        return response()->json(['ok' => true, 'data' => $column]);
    }

    // DELETE /sys/kanban/columns/{column}
    public function destroyColumn(KanbanColumn $column): JsonResponse
    {
        $column->delete();

        return response()->json(['ok' => true]);
    }

    // POST /sys/kanban/columns/reorder
    public function reorderColumns(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);

        foreach ($data['ids'] as $position => $id) {
            KanbanColumn::where('id', $id)->update(['position' => $position]);
        }

        return response()->json(['ok' => true]);
    }

    // POST /sys/kanban/cards
    public function storeCard(Request $request): JsonResponse
    {
        $data = $request->validate([
            'column_id'   => 'required|exists:kanban_columns,id',
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string',
            'priority'    => ['nullable', Rule::in(['none', 'low', 'medium', 'high', 'urgent'])],
            'due_date'    => 'nullable|date',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        $maxPos = KanbanCard::where('column_id', $data['column_id'])->max('position') ?? -1;

        $card = KanbanCard::create([
            ...$data,
            'created_by' => $request->user()->id,
            'priority'   => $data['priority'] ?? 'none',
            'position'   => $maxPos + 1,
        ]);

        $card->load(['creator:id,swc_handle', 'assignee:id,swc_handle']);

        return response()->json(['ok' => true, 'data' => $card], 201);
    }

    // PATCH /sys/kanban/cards/{card}
    public function updateCard(Request $request, KanbanCard $card): JsonResponse
    {
        $data = $request->validate([
            'column_id'   => 'sometimes|exists:kanban_columns,id',
            'title'       => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'priority'    => ['nullable', Rule::in(['none', 'low', 'medium', 'high', 'urgent'])],
            'due_date'    => 'nullable|date',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        $card->update($data);
        $card->load(['creator:id,swc_handle', 'assignee:id,swc_handle', 'ticket:id,title']);

        return response()->json(['ok' => true, 'data' => $card]);
    }

    // DELETE /sys/kanban/cards/{card}
    public function destroyCard(KanbanCard $card): JsonResponse
    {
        $card->delete();

        return response()->json(['ok' => true]);
    }

    // POST /sys/kanban/cards/reorder
    public function reorderCards(Request $request): JsonResponse
    {
        $data = $request->validate([
            'column_id' => 'required|exists:kanban_columns,id',
            'ids'       => 'required|array',
            'ids.*'     => 'integer',
        ]);

        foreach ($data['ids'] as $position => $id) {
            KanbanCard::where('id', $id)->update(['column_id' => $data['column_id'], 'position' => $position]);
        }

        return response()->json(['ok' => true]);
    }

    // POST /sys/kanban/tickets/{ticket}/promote
    public function promoteTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['column_id' => 'required|exists:kanban_columns,id']);

        if (KanbanCard::where('ticket_id', $ticket->id)->exists()) {
            return response()->json(['ok' => false, 'message' => 'This ticket is already on the board.'], 422);
        }

        $maxPos = KanbanCard::where('column_id', $data['column_id'])->max('position') ?? -1;

        $card = KanbanCard::create([
            'column_id'   => $data['column_id'],
            'title'       => $ticket->title,
            'description' => null,
            'priority'    => 'none',
            'created_by'  => $request->user()->id,
            'ticket_id'   => $ticket->id,
            'position'    => $maxPos + 1,
        ]);

        $card->load(['creator:id,swc_handle', 'assignee:id,swc_handle', 'ticket:id,title']);

        return response()->json(['ok' => true, 'data' => $card], 201);
    }
}
