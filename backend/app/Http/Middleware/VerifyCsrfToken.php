<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * URIs that should be excluded from CSRF verification.
     *
     * We intentionally keep this EMPTY for the SPA/API. Sanctum +
     * XSRF-TOKEN + X-XSRF-TOKEN will handle CSRF for stateful
     * requests (including /api/*).
     *
     * Only add something here if it truly must bypass CSRF
     * (e.g. external webhook callbacks).
     */
    protected $except = [
        // e.g. 'stripe/webhook',
    ];
}