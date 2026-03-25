<?php

return [
    'client_id' => env('DISCORD_CLIENT_ID'),
    'client_secret' => env('DISCORD_CLIENT_SECRET'),
    'authorize_url' => env('DISCORD_AUTHORIZE_URL', 'https://discord.com/oauth2/authorize'),
    'token_url' => env('DISCORD_TOKEN_URL', 'https://discord.com/api/oauth2/token'),
    'api_base' => env('DISCORD_API_BASE', 'https://discord.com/api'),
    'redirect_uri' => env('DISCORD_REDIRECT_URI'),
    'scope' => env('DISCORD_SCOPE', 'identify'),
    'frontend_url' => env('DISCORD_FRONTEND_URL', env('SWC_FRONTEND_URL')),
];
