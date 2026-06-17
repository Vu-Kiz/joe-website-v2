# NPM Custom Nginx Config — Ingestion Proxy

Add these snippets to the **Advanced → Custom Nginx Configuration** tab for each proxy host in Nginx Proxy Manager. This routes tracker traffic through your own domain so adblockers can't block it.

OpenReplay is hosted separately at `openreplay.swc-anarchy-industries.co.uk` — the `/ingest/` rules below forward externally to it rather than to a local container.

---

## www.swc-joe.com (prod frontend proxy host)

```nginx
# OpenReplay session ingestion — proxied externally to Anarchy Industries OpenReplay instance
location /ingest/ {
    proxy_pass https://openreplay.swc-anarchy-industries.co.uk/ingest/;
    proxy_http_version 1.1;
    proxy_set_header Host openreplay.swc-anarchy-industries.co.uk;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# GlitchTip error ingestion
location /errors/ {
    proxy_pass http://joe_glitchtip_prod:8000/errors/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## dev-v2.swc-joe.com (dev frontend proxy host)

```nginx
# OpenReplay session ingestion — proxied externally to Anarchy Industries OpenReplay instance
location /ingest/ {
    proxy_pass https://openreplay.swc-anarchy-industries.co.uk/ingest/;
    proxy_http_version 1.1;
    proxy_set_header Host openreplay.swc-anarchy-industries.co.uk;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# GlitchTip error ingestion
location /errors/ {
    proxy_pass http://joe_glitchtip_dev:8000/errors/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## New proxy hosts to add in NPM (JOE server)

| Domain | Forward to | Port |
|--------|-----------|------|
| `glitchtip.swc-joe.com` | `joe_glitchtip_prod` | `8000` |
| `glitchtip-dev.swc-joe.com` | `joe_glitchtip_dev` | `8000` |

Enable SSL via Let's Encrypt for both as usual.

OpenReplay (`openreplay.swc-anarchy-industries.co.uk`) is managed separately on the Anarchy Industries server — no proxy host needed on the JOE server.
