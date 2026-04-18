type BridgeAction =
  | "ping"
  | "getAuthConfig"
  | "setAuthConfig"
  | "clearAuthToken"
  | "getState"
  | "getCounter"
  | "setCounter"
  | "getPrefix"
  | "setPrefix"
  | "resetCounter"
  | "countBack"
  | "stampNow"
  | "toggleRecycle";

type BridgeRequest = {
  source: "joe-website";
  type: "JOE_EXTENSION_REQUEST";
  requestId: string;
  action: BridgeAction;
  payload?: Record<string, unknown>;
};

type BridgeResponse = {
  source: "joe-wrecking-helper-extension";
  type: "JOE_EXTENSION_RESPONSE";
  requestId: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

const REQUEST_SOURCE = "joe-website";
const RESPONSE_SOURCE = "joe-wrecking-helper-extension";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wrecking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isWreckingHelperAvailable(timeoutMs = 700): Promise<boolean> {
  return callWreckingHelper("ping", {}, timeoutMs)
    .then((result) => Boolean(result?.connected))
    .catch(() => false);
}

export function callWreckingHelper(
  action: BridgeAction,
  payload: Record<string, unknown> = {},
  timeoutMs = 1500
): Promise<Record<string, unknown>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is unavailable."));
  }

  const requestId = createRequestId();
  const request: BridgeRequest = {
    source: REQUEST_SOURCE,
    type: "JOE_EXTENSION_REQUEST",
    requestId,
    action,
    payload,
  };

  return new Promise((resolve, reject) => {
    let timeoutHandle: number | null = null;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      const response = event.data as BridgeResponse | undefined;
      if (!response || response.source !== RESPONSE_SOURCE || response.type !== "JOE_EXTENSION_RESPONSE") {
        return;
      }
      if (response.requestId !== requestId) {
        return;
      }

      cleanup();
      if (response.ok) {
        resolve(response.data ?? {});
      } else {
        reject(new Error(response.error ?? "Extension returned a failed response."));
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };

    timeoutHandle = window.setTimeout(() => {
      cleanup();
      reject(new Error("No extension response received. Is Wrecking Helper loaded?"));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage(request, window.location.origin);
  });
}
