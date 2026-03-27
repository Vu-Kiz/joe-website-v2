<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmployeeSpotlight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\Admin\AdminActionLogger;

class EmployeeSpotlightController extends Controller
{
    public function index(): JsonResponse
    {
        $entries = EmployeeSpotlight::query()
            ->latest('created_at')
            ->latest('id')
            ->get()
            ->map(fn (EmployeeSpotlight $entry) => $this->transform($entry))
            ->values();

        return response()->json([
            'ok' => true,
            'entries' => $entries,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_url' => ['nullable', 'string', 'max:255'],
        ]);

        $entry = new EmployeeSpotlight();
        $entry->name = trim($validated['name']);
        $entry->reason = trim($validated['reason']);
        $entry->image_path = $validated['image_path'] ?? null;
        $entry->image_url = $validated['image_url'] ?? null;
        $entry->save();

        AdminActionLogger::log(
            $request,
            'eotm',
            'create',
            'Created EoTM entry',
            'employee_spotlight',
            $entry->id,
            null,
            $this->transform($entry)
        );

        return response()->json([
            'ok' => true,
            'entry' => $this->transform($entry),
        ], 201);
    }

    public function update(Request $request, EmployeeSpotlight $employeeSpotlight): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_url' => ['nullable', 'string', 'max:255'],
        ]);

        $before = $this->transform($employeeSpotlight);

        $employeeSpotlight->name = trim($validated['name']);
        $employeeSpotlight->reason = trim($validated['reason']);
        $employeeSpotlight->image_path = $validated['image_path'] ?? null;
        $employeeSpotlight->image_url = $validated['image_url'] ?? null;
        $employeeSpotlight->save();

        AdminActionLogger::log(
            $request,
            'eotm',
            'update',
            'Updated EoTM entry',
            'employee_spotlight',
            $employeeSpotlight->id,
            $before,
            $this->transform($employeeSpotlight)
        );

        return response()->json([
            'ok' => true,
            'entry' => $this->transform($employeeSpotlight),
        ]);
    }

    public function destroy(Request $request, EmployeeSpotlight $employeeSpotlight): JsonResponse
    {
        $before = $this->transform($employeeSpotlight);
        $targetId = $employeeSpotlight->id;

        $employeeSpotlight->delete();

        AdminActionLogger::log(
            $request,
            'eotm',
            'delete',
            'Deleted EoTM entry',
            'employee_spotlight',
            $targetId,
            $before,
            null
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    private function transform(EmployeeSpotlight $entry): array
    {
        return [
            'id' => $entry->id,
            'name' => $entry->name,
            'reason' => $entry->reason,
            'image_path' => $entry->image_path,
            'image_url' => $entry->image_url,
            'created_at' => optional($entry->created_at)?->toIso8601String(),
            'updated_at' => optional($entry->updated_at)?->toIso8601String(),
        ];
    }
}
