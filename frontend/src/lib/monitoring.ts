import * as Sentry from '@sentry/react';
import Tracker from '@openreplay/tracker';
import trackerAssist from '@openreplay/tracker-assist';

const isProd = import.meta.env.VITE_APP_ENV === 'production';

// GlitchTip — routed through own domain to bypass adblockers
const GLITCHTIP_DSN = import.meta.env.VITE_GLITCHTIP_DSN as string | undefined;
const GLITCHTIP_TUNNEL = import.meta.env.VITE_GLITCHTIP_TUNNEL as string | undefined;

// OpenReplay — routed through own domain to bypass adblockers
const OPENREPLAY_KEY = import.meta.env.VITE_OPENREPLAY_KEY as string | undefined;
const OPENREPLAY_INGEST = import.meta.env.VITE_OPENREPLAY_INGEST_URL as string | undefined;

let tracker: Tracker | null = null;

export function initMonitoring(): void {
    if (GLITCHTIP_DSN) {
        Sentry.init({
            dsn: GLITCHTIP_DSN,
            tunnel: GLITCHTIP_TUNNEL,
            environment: isProd ? 'production' : 'development',
            tracesSampleRate: isProd ? 0.1 : 1.0,
            // Don't report 401s or 404s — not actionable
            ignoreErrors: [
                'Network Error',
                /Request failed with status code 401/,
                /Request failed with status code 404/,
            ],
        });
    }

    if (OPENREPLAY_KEY && OPENREPLAY_INGEST) {
        const SENSITIVE = ['password', 'token', 'access_token', 'refresh_token', 'secret'];

        tracker = new Tracker({
            projectKey: OPENREPLAY_KEY,
            ingestPoint: OPENREPLAY_INGEST,
            obscureTextEmails: true,
            obscureInputEmails: true,
            defaultInputMode: 1, // mask all inputs by default
            network: {
                capturePayload: true,
                failuresOnly: false,
                sessionTokenHeader: false,
                ignoreHeaders: false,
                captureInIframes: false,
                sanitizer: (data) => {
                    if (data.request.body && typeof data.request.body === 'object') {
                        SENSITIVE.forEach((key) => delete (data.request.body as any)[key]);
                    }
                    if (data.response.body && typeof data.response.body === 'object') {
                        SENSITIVE.forEach((key) => delete (data.response.body as any)[key]);
                    }
                    delete data.request.headers?.['X-XSRF-TOKEN'];
                    delete data.request.headers?.['Cookie'];
                    return data;
                },
            },
        });
        tracker.use(trackerAssist());
        tracker.start();
    }
}

export function identifyUser(handle: string, userId: number): void {
    if (GLITCHTIP_DSN) {
        Sentry.setUser({ username: handle, id: String(userId) });
    }
    if (tracker) {
        tracker.setUserID(handle);
        tracker.setMetadata('userId', String(userId));
    }
}

export function clearUser(): void {
    if (GLITCHTIP_DSN) {
        Sentry.setUser(null);
    }
}
