<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class UploadController extends Controller
{
    /**
     * Expandable type → directory mapping.
     */
    private const TYPES = [
        'blog'     => ['dir' => 'uploads/blog',     'max_kb' => 5120, 'mimes' => 'jpg,jpeg,png,webp'],
        'employee' => ['dir' => 'uploads/employee', 'max_kb' => 5120, 'mimes' => 'jpg,jpeg,png,webp'],
        'banner'   => ['dir' => 'uploads/banners',  'max_kb' => 8192, 'mimes' => 'jpg,jpeg,png,webp'],
        'jen'      => ['dir' => 'uploads/jen',      'max_kb' => 20480, 'mimes' => 'jpg,jpeg,png,gif,webp'],
        'misc'     => ['dir' => 'uploads/misc',     'max_kb' => 5120, 'mimes' => 'jpg,jpeg,png,webp'],
    ];

    public function store(Request $request)
    {
        $type = $request->query('type', 'misc');

        if (!isset(self::TYPES[$type])) {
            throw ValidationException::withMessages([
                'type' => ["Unknown upload type '{$type}'"],
            ]);
        }

        $cfg = self::TYPES[$type];

        $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:' . $cfg['mimes'], 'max:' . $cfg['max_kb']],
        ]);

        // Store on "public" disk → served via /storage symlink
        $path = $request->file('file')->store($cfg['dir'], 'public');

        // IMPORTANT: store URL as a *relative* /storage/... path
        $relativeUrl = '/storage/' . ltrim($path, '/');

        return response()->json([
            'ok'   => true,
            'type' => $type,
            'path' => $path,        // e.g. "uploads/blog/xxx.png"
            'url'  => $relativeUrl, // e.g. "/storage/uploads/blog/xxx.png"
        ]);
    }
}
