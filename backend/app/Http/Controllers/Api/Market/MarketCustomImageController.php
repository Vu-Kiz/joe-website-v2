<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Market;

use App\Http\Controllers\Controller;
use App\Support\Market\MarketWatermarkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MarketCustomImageController extends Controller
{
    public function __construct(protected MarketWatermarkService $watermark) {}

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'max:8192', 'mimes:jpeg,png,webp'],
        ]);

        $file = $request->file('image');
        $mime = $file->getMimeType();

        $src = match ($mime) {
            'image/png'  => imagecreatefrompng($file->getRealPath()),
            'image/webp' => imagecreatefromwebp($file->getRealPath()),
            default      => imagecreatefromjpeg($file->getRealPath()),
        };

        if ($src === false) {
            return response()->json(['ok' => false, 'message' => 'Could not read image.'], 422);
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);

        $dir      = 'market-customs/' . date('Y/m');
        $basename = Str::random(32);

        $result = $this->watermark->watermarkUploadedFile($src, $srcW, $srcH, $dir, $basename);
        imagedestroy($src);

        return response()->json([
            'ok'               => true,
            'original_path'    => $result['original_path'],
            'watermarked_path' => $result['watermarked_path'],
            'original_url'     => $result['original_url'],
            'watermarked_url'  => $result['watermarked_url'],
        ]);
    }
}
