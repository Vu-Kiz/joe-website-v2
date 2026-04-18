export type WebsiteBridgeAction =
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

export type WebsiteBridgeRequest = {
  source: "joe-website";
  type: "JOE_EXTENSION_REQUEST";
  requestId: string;
  action: WebsiteBridgeAction;
  payload?: Record<string, unknown>;
};

export type WebsiteBridgeResponse = {
  source: "joe-wrecking-helper-extension";
  type: "JOE_EXTENSION_RESPONSE";
  requestId: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export type RuntimeMessage =
  | { action: "getCounter" }
  | { action: "setCounter"; value: number }
  | { action: "getPrefix" }
  | { action: "setPrefix"; value: string }
  | { action: "stampNow" }
  | { action: "countBack" }
  | { action: "toggleRecycle" }
  | { action: "getAuthConfig" }
  | { action: "setAuthConfig"; apiBaseUrl: string; token?: string }
  | { action: "clearAuthToken" }
  | { action: "websiteBridge"; request: WebsiteBridgeRequest };

export type BridgeResult = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};
