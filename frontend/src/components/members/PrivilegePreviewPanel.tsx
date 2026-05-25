import React, { useState } from "react";
import type { SwcUser } from "../../api/core/auth";
import { toggleLockJoeFlags, toggleSubscriberPreview } from "../../api/admin/adminToolStore";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM } from "../../utils/ui";

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
  const privBtnCls = (active: boolean) =>
    BTN_SM + " flex justify-between items-center gap-2 text-left " +
    (active ? "border-[rgba(246,163,0,0.55)] shadow-[inset_0_0_0_1px_rgba(246,163,0,0.16)] bg-[rgba(246,163,0,0.12)]" : "opacity-90");

  return (
    <div className="grid gap-2">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <label className="small">{title}</label>
        <div className="flex flex-wrap gap-[0.4rem]">
          <button type="button" className={BTN_SM} onClick={() => applyPreset("subscriber")}>
            Subscriber Preset
          </button>
          <button type="button" className={BTN_SM} onClick={() => applyPreset("member")}>
            Member Preset
          </button>
          <button type="button" className={BTN_SM} onClick={() => applyPreset("admin")}>
            Admin Preset
          </button>
          <button type="button" className={BTN_SM} onClick={() => applyPreset("sysadmin")}>
            Sysadmin Preset
          </button>
          <button type="button" className={BTN_SM} onClick={onReset}>
            Reset to My Privs
          </button>
        </div>
        {onViewerChange && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              className={viewer?.lock_joe_flags ? BTN_SM + " is-active" : BTN_SM}
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
              className={viewer?.force_subscriber_tier ? BTN_SM + " is-active" : BTN_SM}
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[0.45rem]">
        <button type="button" className={value.isJoeMember ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("isJoeMember")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">is_joe_member</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.isJoeMember ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.isIntel ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("isIntel")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">is_intel</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.isIntel ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canAccessCombatCalc ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canAccessCombatCalc")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_access_combat_calc</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canAccessCombatCalc ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canManageBlog ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canManageBlog")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_manage_blog</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canManageBlog ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canAccessWreckingHelper ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canAccessWreckingHelper")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_access_wrecking_helper_extension</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canAccessWreckingHelper ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canAccessFleetCommander ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canAccessFleetCommander")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_access_fleet_commander</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canAccessFleetCommander ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canAccessRmBrowser ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canAccessRmBrowser")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_access_rm_browser</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canAccessRmBrowser ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.canViewAsteroidIntel ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("canViewAsteroidIntel")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">can_view_asteroid_intel</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.canViewAsteroidIntel ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.isAdmin ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("isAdmin")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">is_admin</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.isAdmin ? "ON" : "OFF"}</span>
        </button>
        <button type="button" className={value.isSysadmin ? privBtnCls(true) : privBtnCls(false)} onClick={() => toggle("isSysadmin")}>
          <span className="text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis">is_sysadmin</span>
          <span className="text-[0.7rem] font-extrabold tracking-[0.04em]">{value.isSysadmin ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
};

export default PrivilegePreviewPanel;
