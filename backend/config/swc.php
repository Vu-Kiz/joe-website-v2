<?php

return [
    'client_id'     => env('SWC_CLIENT_ID'),
    'client_secret' => env('SWC_CLIENT_SECRET'),

    'authorize_url' => env('SWC_OAUTH_AUTHORIZE_URL', 'https://www.swcombine.com/ws/oauth2/auth/'),
    'token_url'     => env('SWC_OAUTH_TOKEN_URL', 'https://www.swcombine.com/ws/oauth2/token/'),
    'api_base'      => env('SWC_API_BASE', 'https://www.swcombine.com/ws/v2.0/api'),

    'redirect_uri'  => env('SWC_OAUTH_REDIRECT_URI'),

    'default_scope' => env('SWC_OAUTH_SCOPE', 'character_read'),
    'access_type'   => env('SWC_OAUTH_ACCESS_TYPE', 'online'),
];
