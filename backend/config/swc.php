<?php

return [
    'client_id'     => env('SWC_OAUTH_CLIENT_ID'),
    'client_secret' => env('SWC_OAUTH_CLIENT_SECRET'),

    'authorize_url' => env('SWC_OAUTH_AUTHORIZE_URL', 'https://www.swcombine.com/ws/oauth2/auth/'),
    'token_url'     => env('SWC_OAUTH_TOKEN_URL', 'https://www.swcombine.com/ws/oauth2/token/'),
    'revoke_url'    => env('SWC_OAUTH_REVOKE_URL', 'https://www.swcombine.com/ws/oauth2/revoke'),
    'api_base'      => env('SWC_OAUTH_API_BASE', 'https://www.swcombine.com/ws/v2.0'),

    'default_scope' => env('SWC_OAUTH_DEFAULT_SCOPE', 'character_read'),
    'member_tools_scope' => env('SWC_OAUTH_MEMBER_TOOLS_SCOPE', 'character_read character_events character_credits character_credits_write faction_credits_read faction_credits_write character_privileges'),
    'member_tool_scopes' => [
        'galaxy' => 'character_read character_events',
        'payments' => 'character_read character_credits character_credits_write faction_credits_read faction_credits_write character_privileges',
    ],
    'creditlog_scope' => env('SWC_OAUTH_CREDITLOG_SCOPE','character_read character_credits character_credits_write faction_credits_read faction_credits_write character_privileges'),
    'events_scope'  => env('SWC_OAUTH_EVENTS_SCOPE', 'character_events'),
    'debug_scope'   => env('SWC_OAUTH_DEBUG_SCOPE', 'character_all faction_all messages_all'),

    'access_type'   => env('SWC_OAUTH_ACCESS_TYPE', 'offline'),
    'member_tools_access_type' => env('SWC_OAUTH_MEMBER_TOOLS_ACCESS_TYPE', 'offline'),
    'creditlog_access_type' => env('SWC_OAUTH_CREDITLOG_ACCESS_TYPE', 'offline'),
    'events_access_type' => env('SWC_OAUTH_EVENTS_ACCESS_TYPE', 'offline'),
    'debug_access_type'  => env('SWC_OAUTH_DEBUG_ACCESS_TYPE', 'offline'),

    'redirect_uri'  => env('SWC_OAUTH_REDIRECT_URI'),

    'frontend_url'  => env('SWC_FRONTEND_URL'),

    'http_user_agent' => env('SWC_HTTP_USER_AGENT', 'JOE API Client'),
    'http_connect_timeout' => (int) env('SWC_HTTP_CONNECT_TIMEOUT', 30),
    'http_timeout' => (int) env('SWC_HTTP_TIMEOUT', 120),
    'http_retry_attempts' => (int) env('SWC_HTTP_RETRY_ATTEMPTS', 3),
    'http_retry_backoff_ms' => (int) env('SWC_HTTP_RETRY_BACKOFF_MS', 1000),
];
