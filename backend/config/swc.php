<?php

return [
    'client_id'     => env('SWC_OAUTH_CLIENT_ID'),
    'client_secret' => env('SWC_OAUTH_CLIENT_SECRET'),

    'authorize_url' => env('SWC_OAUTH_AUTHORIZE_URL', 'https://www.swcombine.com/ws/oauth2/auth/'),
    'token_url'     => env('SWC_OAUTH_TOKEN_URL', 'https://www.swcombine.com/ws/oauth2/token/'),
    'api_base'      => env('SWC_OAUTH_API_BASE', 'https://www.swcombine.com/ws/v2.0'),

    'default_scope' => env('SWC_OAUTH_DEFAULT_SCOPE', 'character_read'),
    'creditlog_scope' => env('SWC_OAUTH_CREDITLOG_SCOPE','character_read character_credits faction_credits_read character_privileges'),
    'debug_scope'   => env('SWC_OAUTH_DEBUG_SCOPE', 'character_all faction_all messages_all'),

    'access_type'   => env('SWC_OAUTH_ACCESS_TYPE', 'online'),
    'creditlog_access_type' => env('SWC_OAUTH_CREDITLOG_ACCESS_TYPE', 'offline'),
    'debug_access_type'  => env('SWC_OAUTH_DEBUG_ACCESS_TYPE', 'offline'),

    'redirect_uri'  => env('SWC_OAUTH_REDIRECT_URI'),

    'frontend_url'  => env('SWC_FRONTEND_URL'),

    'http_user_agent' => env('SWC_HTTP_USER_AGENT', 'JOE API Client'),
];