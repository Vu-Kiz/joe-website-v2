<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class UploadController extends Controller
{
    /**
     * Expandability lives here.
     * Add new buckets later without touching blog code.
     */
    private const TYPES = [
        'blog'     => ['dir' => 'uploads/blog',     'max_kb' => 5120],
        'employee' => ['dir' => 'uploads/employee', 'max_kb' => 5120],
        'banner'   => ['dir' => 'uploads/banners',  'max_kb' => 8192],
        'jen'      => ['dir' => 'uploads/jen',      'max_kb' => 5120],
        'misc'     => ['dir' => 'uploads/misc',     'max_kb' => 5120],
    ];

    public function store(Request $request)
    {
        $type = strtolower(trim((string) $request->query('type', $request->input('type', 'misc'))));

        if (!array_key_exists($type, self::TYPES)) {
            throw ValidationException::withMessages(['type' => ['Invalid upload type.']]);
        }

        $cfg = self::TYPES[$type];

        $request->validate([
            'file' => ['required', 'file', 'image', 'max:' . $cfg['max_kb']],
        ]);

        // Store in "public" disk so it can be served via /storage
        $path = $request->file('file')->store($cfg['dir'], 'public');
        $url  = Storage::disk('public')->url($path);

        return response()->json([
            'ok'   => true,
            'type' => $type,
            'path' => $path,
            'url'  => $url,
        ]);
    }
}
