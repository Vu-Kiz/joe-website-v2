<?php

declare(strict_types=1);

namespace App\Support\Market;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MarketWatermarkService
{
    private const MAX_DIMENSION = 2000;
    private const WATERMARK_OPACITY = 25;

    /**
     * Fetch an image from a URL, apply the watermark, save to public storage,
     * and return the public URL. Returns null on failure.
     */
    public function watermarkFromUrl(string $imageUrl): ?string
    {
        $raw = @file_get_contents($imageUrl);
        if ($raw === false || $raw === '') {
            return null;
        }

        $src = @imagecreatefromstring($raw);
        if ($src === false) {
            return null;
        }

        [$src, $srcW, $srcH] = $this->capDimensions($src);

        $watermarked = $this->applyWatermark($src, $srcW, $srcH);
        imagedestroy($src);

        $dir      = 'market-wm/' . date('Y/m');
        $path     = $dir . '/' . Str::random(32) . '_wm.jpg';
        Storage::disk('public')->makeDirectory($dir);
        $fullPath = Storage::disk('public')->path($path);

        imagejpeg($watermarked, $fullPath, 92);
        imagedestroy($watermarked);

        return rtrim(env('BACKEND_STORAGE_URL', config('app.url') . '/storage'), '/') . '/' . $path;
    }

    /**
     * Watermark an uploaded file (GD resource already loaded by caller).
     * Saves both original and watermarked copies; returns their paths and URLs.
     */
    public function watermarkUploadedFile(\GdImage $src, int $srcW, int $srcH, string $dir, string $basename): array
    {
        $storageBase = rtrim(env('BACKEND_STORAGE_URL', config('app.url') . '/storage'), '/');
        Storage::disk('public')->makeDirectory($dir);

        $origPath = $dir . '/' . $basename . '_orig.jpg';
        imagejpeg($src, Storage::disk('public')->path($origPath), 92);

        $watermarked = $this->applyWatermark($src, $srcW, $srcH);
        $wmPath      = $dir . '/' . $basename . '_wm.jpg';
        imagejpeg($watermarked, Storage::disk('public')->path($wmPath), 92);
        imagedestroy($watermarked);

        return [
            'original_path'    => $origPath,
            'watermarked_path' => $wmPath,
            'original_url'     => $storageBase . '/' . $origPath,
            'watermarked_url'  => $storageBase . '/' . $wmPath,
        ];
    }

    public function applyWatermark(\GdImage $src, int $srcW, int $srcH): \GdImage
    {
        $wmPath = base_path('resources/MarketWM.png');
        if (!file_exists($wmPath)) {
            $canvas = imagecreatetruecolor($srcW, $srcH);
            imagecopy($canvas, $src, 0, 0, 0, 0, $srcW, $srcH);
            return $canvas;
        }

        $wm = @imagecreatefrompng($wmPath);
        if ($wm === false) {
            $canvas = imagecreatetruecolor($srcW, $srcH);
            imagecopy($canvas, $src, 0, 0, 0, 0, $srcW, $srcH);
            return $canvas;
        }

        $wmW = imagesx($wm);
        $wmH = imagesy($wm);

        // Scale source image UP to watermark dimensions so alpha compositing
        // happens at full resolution (avoids alpha averaging to nothing on small images)
        $upscaled = imagecreatetruecolor($wmW, $wmH);
        imagecopyresampled($upscaled, $src, 0, 0, 0, 0, $wmW, $wmH, $srcW, $srcH);

        // Apply opacity to the watermark while preserving its alpha mask
        $this->applyOpacity($wm, $wmW, $wmH, self::WATERMARK_OPACITY);

        // Composite the watermark onto the upscaled source
        imagealphablending($upscaled, true);
        imagecopy($upscaled, $wm, 0, 0, 0, 0, $wmW, $wmH);
        imagedestroy($wm);

        // Scale back down to original dimensions
        $canvas = imagecreatetruecolor($srcW, $srcH);
        imagecopyresampled($canvas, $upscaled, 0, 0, 0, 0, $srcW, $srcH, $wmW, $wmH);
        imagedestroy($upscaled);

        return $canvas;
    }

    private function applyOpacity(\GdImage $img, int $w, int $h, int $opacityPct): void
    {
        imagealphablending($img, false);
        imagesavealpha($img, true);

        for ($x = 0; $x < $w; $x++) {
            for ($y = 0; $y < $h; $y++) {
                $color    = imagecolorat($img, $x, $y);
                $alpha    = ($color >> 24) & 0x7F;
                $r        = ($color >> 16) & 0xFF;
                $g        = ($color >> 8) & 0xFF;
                $b        = $color & 0xFF;
                // Scale the opaque portion by opacityPct — transparent pixels stay transparent
                $opaque   = 127 - $alpha;
                $newOpaque = (int) round($opaque * $opacityPct / 100);
                $newAlpha  = 127 - $newOpaque;
                imagesetpixel($img, $x, $y, imagecolorallocatealpha($img, $r, $g, $b, $newAlpha));
            }
        }
    }

    private function capDimensions(\GdImage $src): array
    {
        $srcW = imagesx($src);
        $srcH = imagesy($src);

        if ($srcW > self::MAX_DIMENSION || $srcH > self::MAX_DIMENSION) {
            $ratio  = min(self::MAX_DIMENSION / $srcW, self::MAX_DIMENSION / $srcH);
            $newW   = (int) round($srcW * $ratio);
            $newH   = (int) round($srcH * $ratio);
            $scaled = imagecreatetruecolor($newW, $newH);
            imagecopyresampled($scaled, $src, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);
            imagedestroy($src);
            return [$scaled, $newW, $newH];
        }

        return [$src, $srcW, $srcH];
    }
}
