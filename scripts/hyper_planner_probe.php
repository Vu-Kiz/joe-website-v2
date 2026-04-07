<?php

require __DIR__ . '/../backend/vendor/autoload.php';

$app = require __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $request = Illuminate\Http\Request::create('/api/universe/hyper-planner', 'GET', [
        'from' => '9:1051',
        'to' => '9:1010',
        'piloting_skill' => 5,
        'hyperspeed' => 8,
    ]);

    $controller = $app->make(App\Http\Controllers\Api\Universe\UniverseController::class);
    $response = $controller->hyperPlanner($request);

    echo $response->getStatusCode(), PHP_EOL;
    echo $response->getContent(), PHP_EOL;
} catch (Throwable $e) {
    echo get_class($e), PHP_EOL;
    echo $e->getMessage(), PHP_EOL;
    echo $e->getFile(), ':', $e->getLine(), PHP_EOL;
    echo $e->getTraceAsString(), PHP_EOL;
    exit(1);
}
