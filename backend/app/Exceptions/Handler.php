<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception): JsonResponse|\Symfony\Component\HttpFoundation\Response
    {
        if (
            $request instanceof Request
            && (
                $request->expectsJson()
                || $request->wantsJson()
                || $request->is('api/*')
            )
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
                'error_code' => 'unauthenticated',
            ], 401);
        }

        return parent::unauthenticated($request, $exception);
    }
}
