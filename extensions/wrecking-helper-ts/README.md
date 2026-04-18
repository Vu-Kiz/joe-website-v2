# Wrecking Helper (TypeScript)

TypeScript port of the original `wrecking-helper` extension with a website bridge so `swc-joe` pages can talk to the extension.

## What this adds

- TypeScript source for background/content/popup/modules.
- Keyboard workflows (stamp, countback, set, recycle toggle) plus reset from popup.
- Website bridge over `window.postMessage`.
- Optional direct external messaging (`chrome.runtime.sendMessage(extensionId, ...)`) via `externally_connectable`.
- Backend authorization gate for sensitive actions (`stamp`, `countback`, `recycle`) using bearer token.
- Prefix is synced to backend per-user settings when token is configured.

## Build

```bash
cd extensions/wrecking-helper-ts
npm install
npm run build
```

Load `extensions/wrecking-helper-ts/dist` as unpacked extension in `chrome://extensions`.

## Browser Packages

- Chromium package uses `src/manifest.json` (Chrome/Edge/Brave/Opera).

## Backend authorization setup

1. Open extension popup.
2. Set API base URL (for example `https://api.swc-joe.com` or `http://localhost:8000`).
3. Paste bearer token.
4. Save.

The extension will call:

- `POST /api/extension/authorize-action`
- `GET /api/extension/wrecking-helper/settings`
- `PUT /api/extension/wrecking-helper/settings`

before running `stamp`, `countback`, and `recycle`.

## Website Bridge Protocol

### Request from website page JS

```ts
window.postMessage({
  source: "joe-website",
  type: "JOE_EXTENSION_REQUEST",
  requestId: crypto.randomUUID(),
  action: "getState"
}, window.location.origin);
```

### Listen for response

```ts
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.source !== "joe-wrecking-helper-extension") return;
  if (data.type !== "JOE_EXTENSION_RESPONSE") return;
  console.log("Extension response:", data);
});
```

### Supported actions

- `ping`
- `getState`
- `getCounter`
- `setCounter` with `payload.value`
- `getPrefix`
- `setPrefix` with `payload.value`
- `resetCounter`
- `countBack`
- `stampNow`
- `toggleRecycle`

## Notes

- Stamping/countback still only run on SWCombine stamp page.
- Bridge origins are allow-listed in `content.ts` and `manifest.json`.
- If you want additional website commands, extend `WebsiteBridgeAction` in `src/modules/types.ts` and switch in `src/background.ts`.
