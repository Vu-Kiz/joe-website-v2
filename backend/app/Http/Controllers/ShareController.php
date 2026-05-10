<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MarketListing;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ShareController extends Controller
{
    public function listing(Request $request, int $id): Response|\Illuminate\Http\RedirectResponse
    {
        $listing = MarketListing::find($id);
        $frontend = rtrim(config('swc.frontend_url', env('SWC_FRONTEND_URL', '/')), '/');
        $spaUrl   = $frontend . '/market?listing=' . $id;

        // Redirect browsers straight to the SPA
        $ua = $request->userAgent() ?? '';
        $isCrawler = preg_match('/Discordbot|Twitterbot|facebookexternalhit|Slackbot|TelegramBot|LinkedInBot|WhatsApp|curl|python/i', $ua);

        if (!$isCrawler) {
            return redirect($spaUrl);
        }

        if (!$listing || !in_array($listing->status, ['open', 'reserved'], true)) {
            $html = $this->renderOg(
                title: 'Listing Not Found — JOE Market',
                description: 'This listing is no longer available.',
                image: null,
                url: $spaUrl,
                spaUrl: $spaUrl,
            );
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        if (!$listing->isVisibleTo(null)) {
            $html = $this->renderOg(
                title: 'Private Listing — JOE Market',
                description: 'This listing is only visible to JOE members.',
                image: null,
                url: $spaUrl,
                spaUrl: $spaUrl,
            );
            return response($html)->header('Content-Type', 'text/html; charset=utf-8');
        }

        $isCustom  = $listing->sale_type === 'custom';
        $name      = $isCustom ? ($listing->custom_entity_name ?? $listing->entity_name) : $listing->entity_name;
        $imageUrl  = $isCustom
            ? ($listing->custom_image_watermarked_path
                ? rtrim(env('BACKEND_STORAGE_URL', config('app.url') . '/storage'), '/') . '/' . $listing->custom_image_watermarked_path
                : null)
            : ($listing->entity_image_url ?? $this->derivedImageUrl($listing));

        $channel     = $listing->channel === 'faction_store' ? 'Faction Store' : 'Member Listing';
        $price       = number_format($listing->price_credits) . ' Credits';
        $entityType  = ucfirst($listing->entity_type);
        $location    = $listing->location_label ? ' · ' . $listing->location_label : '';

        $description = implode(' · ', array_filter([
            $channel,
            $entityType,
            $price . ($listing->entity_type === 'material' ? ' per unit' : ''),
            $listing->quantity_available > 1 ? $listing->quantity_available . ' available' : null,
            $listing->notes ? substr($listing->notes, 0, 120) : null,
        ])) . $location;

        $html = $this->renderOg(
            title: $name . ' — JOE Market',
            description: $description,
            image: $imageUrl,
            url: $spaUrl,
            spaUrl: $spaUrl,
        );

        return response($html)->header('Content-Type', 'text/html; charset=utf-8');
    }

    private function renderOg(string $title, string $description, ?string $image, string $url, string $spaUrl): string
    {
        $t   = htmlspecialchars($title, ENT_QUOTES);
        $d   = htmlspecialchars($description, ENT_QUOTES);
        $u   = htmlspecialchars($url, ENT_QUOTES);
        $img = $image ? htmlspecialchars($image, ENT_QUOTES) : '';

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>{$t}</title>
          <meta name="description" content="{$d}">
          <meta property="og:type" content="website">
          <meta property="og:site_name" content="JOE Market">
          <meta property="og:title" content="{$t}">
          <meta property="og:description" content="{$d}">
          <meta property="og:url" content="{$u}">
          {$this->imgTags($img)}
          <meta name="theme-color" content="#1a1c22">
          <meta http-equiv="refresh" content="0;url={$u}">
        </head>
        <body>
          <p>Redirecting… <a href="{$u}">Click here if not redirected.</a></p>
        </body>
        </html>
        HTML;
    }

    private function derivedImageUrl(MarketListing $listing): ?string
    {
        $typeUid = $listing->entity_type_uid;
        if (!$typeUid) return null;

        $num = preg_replace('/^\d+:/', '', $typeUid);

        return match ($listing->entity_type) {
            'material' => "https://images.swcombine.com//materials/{$num}/main.png",
            'station'  => "https://images.swcombine.com//stations/{$num}/small.gif",
            default    => null,
        };
    }

    private function imgTags(string $img): string
    {
        if (!$img) return '';
        return <<<HTML
          <meta property="og:image" content="{$img}">
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:image" content="{$img}">
        HTML;
    }
}
