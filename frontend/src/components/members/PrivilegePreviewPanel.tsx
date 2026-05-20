import React, { useState } from "react";
import type { SwcUser } from "../../api/auth";
import { toggleLockJoeFlags, toggleSubscriberPreview } from "../../api/adminToolStore";

export type PreviewPrivs = {
  isJoeMember: boolean;
  isIntel: boolean;
  canManageBlog: boolean;
  canAccessCombatCalc: boolean;
  canAccessWreckingHelper: boolean;
  canAccessFleetCommander: boolean;
  canAccessRmBrowser: boolean;
  canViewAsteroidIntel: boolean;
  isAdmin: boolean;
  isSysadmin: boolean;
  previewAsSubscriber: boolean;
};

export function toPreviewPrivs(user: SwcUser | null): PreviewPrivs {
  return {
    isJoeMember: !!user?.is_joe_member,
    isIntel: !!user?.is_intel,
    canManageBlog: !!user?.can_manage_blog || !!user?.is_admin || !!user?.is_sysadmin,
    canAccessCombatCalc: !!user?.can_access_combat_calc || !!user?.is_admin || !!user?.is_sysadmin,
    canAccessWreckingHelper: !!user?.can_access_wrecking_helper_extension || !!user?.is_admin || !!user?.is_sysadmin,
    canAccessFleetCommander: !!user?.can_access_fleet_commander || !!user?.is_admin || !!user?.is_sysadmin,
    canAccessRmBrowser: !!user?.can_access_rm_browser || !!user?.is_admin || !!user?.is_sysadmin,
    canViewAsteroidIntel: !!user?.can_view_asteroid_intel || !!user?.is_admin || !!user?.is_sysadmin,
    isAdmin: !!user?.is_admin,
    isSysadmin: !!user?.is_sysadmin,
    previewAsSubscriber: false,
  };
}

export function canSeeAudienceWithPrivs(audience: string, privs: PreviewPrivs): boolean {
  return (
    audience === "all" ||
    (audience === "members" && (privs.isJoeMember || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "payments" && (privs.isJoeMember || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "droidbrain" && (privs.isJoeMember || privs.isIntel || privs.isSysadmin)) ||
    (audience === "jenEditor" && (privs.canManageBlog || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "combatCalc" && (privs.canAccessCombatCalc || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "wreckingHelper" && (privs.canAccessWreckingHelper || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "fleetCommander" && (privs.canAccessFleetCommander || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "rmBrowser" && (privs.canAccessRmBrowser || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "asteroidIntel" && (privs.canViewAsteroidIntel || privs.isAdmin || privs.isSysadmin)) ||
    (audience === "admin" && (privs.isAdmin || privs.isSysadmin)) ||
    (audience === "sysadmin" && privs.isSysadmin)
  );
}

type PrivilegePreviewPanelProps = {
  value: PreviewPrivs;
  onChange: (next: PreviewPrivs) => void;
  onReset: () => void;
  viewer?: SwcUser | null;
  onViewerChange?: () => void;
  title?: string;
};

const PrivilegePreviewPanel: React.FC<PrivilegePreviewPanelProps> = ({
  value,
  onChange,
  onReset,
  viewer,
  onViewerChange,
  title = "Preview Privileges",
}) => {
  const [togglingBackend, setTogglingBackend] = useState(false);
  const applyPreset = (preset: "subscriber" | "member" | "admin" | "sysadmin") => {
    if (preset === "subscriber") {
      onChange({
        isJoeMember: false,
        isIntel: false,
        canManageBlog: false,
        canAccessCombatCalc: false,
        canAccessWreckingHelper: false,
        canAccessFleetCommander: false,
        canAccessRmBrowser: false,
        canViewAsteroidIntel: false,
        isAdmin: false,
        isSysadmin: false,
        previewAsSubscriber: true,
      });
      return;
    }

    if (preset === "member") {
      onChange({
        isJoeMember: true,
        isIntel: false,
        canManageBlog: false,
        canAccessCombatCalc: false,
        canAccessWreckingHelper: false,
        canAccessFleetCommander: false,
        canAccessRmBrowser: false,
        canViewAsteroidIntel: false,
        isAdmin: false,
        isSysadmin: false,
        previewAsSubscriber: false,
      });
      return;
    }

    if (preset === "admin") {
      onChange({
        isJoeMember: false,
        isIntel: false,
        canManageBlog: true,
        canAccessCombatCalc: true,
        canAccessWreckingHelper: true,
        canAccessFleetCommander: true,
        canAccessRmBrowser: true,
        canViewAsteroidIntel: true,
        isAdmin: true,
        isSysadmin: false,
        previewAsSubscriber: false,
      });
      return;
    }

    onChange({
      isJoeMember: false,
      isIntel: false,
      canManageBlog: true,
      canAccessCombatCalc: true,
      canAccessWreckingHelper: true,
      canAccessFleetCommander: true,
      canAccessRmBrowser: true,
      canViewAsteroidIntel: true,
      isAdmin: false,
      isSysadmin: true,
      previewAsSubscriber: false,
    });
  };

  const toggle = <K extends keyof PreviewPrivs>(key: K) => onChange({ ...value, [key]: !value[key] });

  return (
    <div className="members-changelog__view-as">
      <div className="members-changelog__view-as-head">
        <label className="small">{title}</label>
        <div className="members-changelog__preset-actions">
          <button type="button" className="btn btn--small" onClick={() => applyPreset("subscriber")}>
            Subscriber Preset
          </button>
          <button type="button" className="btn btn--small" onClick={() => applyPreset("member")}>
            Member Preset
          </button>
          <button type="button" className="btn btn--small" onClick={() => applyPreset("admin")}>
            Admin Preset
          </button>
          <button type="button" className="btn btn--small" onClick={() => applyPreset("sysadmin")}>
            Sysadmin Preset
          </button>
          <button type="button" className="btn btn--small" onClick={onReset}>
            Reset to My Privs
          </button>
        </div>
        {onViewerChange && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className={`btn btn--small${viewer?.lock_joe_flags ? " is-active" : ""}`}
              disabled={togglingBackend}
              onClick={async () => {
                setTogglingBackend(true);
                try {
                  await toggleLockJoeFlags();
                  onViewerChange();
                } finally {
                  setTogglingBackend(false);
                }
              }}
            >
              {togglingBackend ? "Toggling…" : viewer?.lock_joe_flags ? "JOE Flag Lock: ON — click to disable" : "Lock JOE Flags (stop auto-grant)"}
            </button>
            <button
              type="button"
              className={`btn btn--small${viewer?.force_subscriber_tier ? " is-active" : ""}`}
              disabled={togglingBackend}
              onClick={async () => {
                setTogglingBackend(true);
                try {
                  await toggleSubscriberPreview();
                  onViewerChange();
                } finally {
                  setTogglingBackend(false);
                }
              }}
            >
              {togglingBackend ? "Toggling…" : viewer?.force_subscriber_tier ? "Subscriber Override: ON — click to disable" : "Force Subscriber Tier"}
            </button>
          </div>
        )}
      </div>
      <div className="members-changelog__priv-grid">
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.isJoeMember ? "is-active" : ""}`} onClick={() => toggle("isJoeMember")}>
          <span className="members-changelog__priv-name">is_joe_member</span>
          <span className="members-changelog__priv-state">{value.isJoeMember ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.isIntel ? "is-active" : ""}`} onClick={() => toggle("isIntel")}>
          <span className="members-changelog__priv-name">is_intel</span>
          <span className="members-changelog__priv-state">{value.isIntel ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canAccessCombatCalc ? "is-active" : ""}`} onClick={() => toggle("canAccessCombatCalc")}>
          <span className="members-changelog__priv-name">can_access_combat_calc</span>
          <span className="members-changelog__priv-state">{value.canAccessCombatCalc ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canManageBlog ? "is-active" : ""}`} onClick={() => toggle("canManageBlog")}>
          <span className="members-changelog__priv-name">can_manage_blog</span>
          <span className="members-changelog__priv-state">{value.canManageBlog ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canAccessWreckingHelper ? "is-active" : ""}`} onClick={() => toggle("canAccessWreckingHelper")}>
          <span className="members-changelog__priv-name">can_access_wrecking_helper_extension</span>
          <span className="members-changelog__priv-state">{value.canAccessWreckingHelper ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canAccessFleetCommander ? "is-active" : ""}`} onClick={() => toggle("canAccessFleetCommander")}>
          <span className="members-changelog__priv-name">can_access_fleet_commander</span>
          <span className="members-changelog__priv-state">{value.canAccessFleetCommander ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canAccessRmBrowser ? "is-active" : ""}`} onClick={() => toggle("canAccessRmBrowser")}>
          <span className="members-changelog__priv-name">can_access_rm_browser</span>
          <span className="members-changelog__priv-state">{value.canAccessRmBrowser ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.canViewAsteroidIntel ? "is-active" : ""}`} onClick={() => toggle("canViewAsteroidIntel")}>
          <span className="members-changelog__priv-name">can_view_asteroid_intel</span>
          <span className="members-changelog__priv-state">{value.canViewAsteroidIntel ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.isAdmin ? "is-active" : ""}`} onClick={() => toggle("isAdmin")}>
          <span className="members-changelog__priv-name">is_admin</span>
          <span className="members-changelog__priv-state">{value.isAdmin ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={`btn btn--small members-changelog__priv-btn ${value.isSysadmin ? "is-active" : ""}`} onClick={() => toggle("isSysadmin")}>
          <span className="members-changelog__priv-name">is_sysadmin</span>
          <span className="members-changelog__priv-state">{value.isSysadmin ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
};

export default PrivilegePreviewPanel;
