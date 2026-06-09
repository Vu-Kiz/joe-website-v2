import React, { useEffect, useState } from "react";
import {
  getWreckingHelperSettings,
  issueWreckingHelperToken,
  revokeWreckingHelperToken,
  updateWreckingHelperSettings,
} from "../../api/market/extensions";
import { getBackendOrigin } from "../../api/core/auth";
import { callWreckingHelper, isWreckingHelperAvailable } from "../../lib/wreckingHelperBridge";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM, INPUT} from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

type MemberWreckingHelperPanelProps = {
  onBack: () => void;
};

const MemberWreckingHelperPanel: React.FC<MemberWreckingHelperPanelProps> = ({ onBack }) => {
  const [guideTab, setGuideTab] = useState<"install" | "loop">("install");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [prefix, setPrefix] = useState("wrecker");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getWreckingHelperSettings();
        if (cancelled) return;
        setPrefix(response.prefix || "wrecker");
        setUpdatedAt(response.updated_at ?? null);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load extension settings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const next = prefix.trim();
    if (!next) {
      setError("Prefix cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const response = await updateWreckingHelperSettings(next);
      setPrefix(response.prefix || next);
      setUpdatedAt(response.updated_at ?? null);
      setNotice("Wrecking Helper prefix saved.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save extension settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectExtension() {
    try {
      setConnecting(true);
      setError(null);
      setNotice(null);

      let available = await isWreckingHelperAvailable(3500);
      if (!available) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        available = await isWreckingHelperAvailable(3500);
      }
      if (!available) {
        setError("Extension bridge was not detected in this tab. Refresh this page once after installing/reloading the extension, then retry.");
        return;
      }

      const tokenResponse = await issueWreckingHelperToken();
      const apiBaseUrl = getBackendOrigin();
      if (!apiBaseUrl) {
        setError("API base URL is not configured on the website.");
        return;
      }

      await callWreckingHelper("setAuthConfig", {
        apiBaseUrl,
        token: tokenResponse.token,
      }, 2500);

      await callWreckingHelper("getPrefix", {}, 1800);
      setNotice("Extension connected. Token + API were set automatically.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect extension.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnectExtension() {
    try {
      setDisconnecting(true);
      setError(null);
      setNotice(null);

      await revokeWreckingHelperToken();
      try {
        await callWreckingHelper("clearAuthToken", {}, 1200);
      } catch {
        // Extension might not be open in this tab; backend revoke is still completed.
      }

      setNotice("Extension token revoked.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke extension token.");
    } finally {
      setDisconnecting(false);
    }
  }

  const STEP_CLS = "grid gap-[0.35rem] p-[0.7rem_0.8rem] rounded-[12px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(246,163,0,0.05))] [&_h4]:m-0 [&_h4]:text-[0.95rem] [&_h4]:text-[rgba(246,163,0,0.95)] [&_p]:m-0 [&_p]:leading-[1.4]";
  const STEP_LOOP_CLS = STEP_CLS + " !border-[rgba(246,163,0,0.38)] ![background:linear-gradient(180deg,rgba(246,163,0,0.1),rgba(246,163,0,0.18))]";
  const GRID_CLS = "grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-[0.65rem]";

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button className={BTN} type="button" onClick={onBack}>
          Back to Overview
        </button>
        <ReportBugButton toolKey="wrecking_helper" toolLabel="Wrecking Helper" />
      </div>

      <section className="panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="h2 m-0">Wrecking Helper</h2>
          <p className="small" style={{ margin: 0 }}>
            Download the extension package and manage the shared prefix setting saved to the website.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <a className={BTN} href="/downloads/wrecking-helper-ts-chromium.zip" download>
              Download Chromium ZIP
            </a>
            <button className={BTN} type="button" onClick={handleConnectExtension} disabled={connecting || disconnecting}>
              {connecting ? "Connecting…" : "Connect Extension"}
            </button>
            <button className={BTN_GHOST} type="button" onClick={handleDisconnectExtension} disabled={disconnecting || connecting}>
              {disconnecting ? "Revoking…" : "Revoke Extension Token"}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="h3" style={{ margin: 0 }}>Prefix Setting</h3>
            {loading ? (
              <p className="small" style={{ margin: 0 }}>Loading settings…</p>
            ) : (
              <>
                <label className="small" htmlFor="wrecking-helper-prefix">Default Prefix</label>
                <input
                  id="wrecking-helper-prefix"
                  type="text"
                  className={INPUT}
                  value={prefix}
                  maxLength={80}
                  onChange={(event) => setPrefix(event.target.value)}
                  placeholder="wrecker"
                />
                <div className="flex flex-wrap gap-3">
                  <button className={BTN} type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save Prefix"}
                  </button>
                </div>
                {updatedAt ? (
                  <p className="small" style={{ margin: 0 }}>
                    Last updated: {new Date(updatedAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {notice ? (
            <p className="small" style={{ color: "#9fda9f", margin: 0 }}>{notice}</p>
          ) : null}
          {error ? (
            <p className="small" style={{ color: "salmon", margin: 0 }}>{error}</p>
          ) : null}

          <div className="flex flex-col gap-3">
            <h3 className="h3" style={{ margin: 0 }}>Guide</h3>
            <div className="flex flex-wrap gap-3">
              <button
                className={(guideTab === "install" ? BTN_SM : BTN_GHOST_SM)}
                type="button"
                onClick={() => setGuideTab("install")}
              >
                Install Steps
              </button>
              <button
                className={(guideTab === "loop" ? BTN_SM : BTN_GHOST_SM)}
                type="button"
                onClick={() => setGuideTab("loop")}
              >
                8-Step Loop
              </button>
            </div>

            {guideTab === "install" ? (
              <div className={GRID_CLS}>
                <article className={STEP_CLS}>
                  <h4>Step 1</h4>
                  <p className="small">Download the Chromium ZIP above and extract it.</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 2</h4>
                  <p className="small">Open <code>chrome://extensions</code> (or <code>edge://extensions</code>).</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 3</h4>
                  <p className="small">
                    Enable Developer Mode, click <code>Load unpacked</code>, and select the extracted folder.
                  </p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 4</h4>
                  <p className="small">Chrome/Edge/Brave/Opera use the same Chromium build.</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 5</h4>
                  <p className="small">
                    Open this page and click <code>Connect Extension</code> to configure token/API automatically.
                  </p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 6</h4>
                  <p className="small">
                    If connect says extension not detected, refresh this tab once and try again.
                  </p>
                </article>
              </div>
            ) : (
              <div className={GRID_CLS}>
                <article className={STEP_CLS}>
                  <h4>Step 1: Stamp field</h4>
                  <p className="small">Action: Focus field and paste ship number (<code>Alt+Q</code>)</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 2: Click Board</h4>
                  <p className="small">Action: Click "Board" button</p>
                  <p className="small">Wait: For page load</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 3: Move to cockpit</h4>
                  <p className="small">Action: Navigate to cockpit (Clicking arrow on the room map is quicker)</p>
                  <p className="small">Wait: For room movement</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 4: Go to recycling page</h4>
                  <p className="small">Action: Alt+W to switch tabs + refresh recycling page</p>
                  <p className="small">Wait: For tab switch and page load.</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 5: Click Recycle</h4>
                  <p className="small">Action: Click "Recycle" button (event listener)</p>
                  <p className="small">Wait: No need to wait on this page</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 6: Return to ship tab</h4>
                  <p className="small">Action: Alt+W to go back to the ship tab</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 7: Move to entrance</h4>
                  <p className="small">Action: Navigate to entrance (Clicking arrow on the room map is quicker)</p>
                </article>
                <article className={STEP_CLS}>
                  <h4>Step 8: Click Board again</h4>
                  <p className="small">Action: Click "Board" button (the B between the arrows on the map works)</p>
                  <p className="small">Wait: For page load</p>
                </article>
                <article className={STEP_LOOP_CLS}>
                  <h4>Loop: Returns to Step 1</h4>
                </article>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default MemberWreckingHelperPanel;
