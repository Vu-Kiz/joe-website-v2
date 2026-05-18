import React from "react";

const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

export type AdminView =
  | "home"
  | "workerHealth"
  | "websiteHealth"
  | "tips"
  | "tenets"
  | "eotm"
  | "weather"
  | "users"
  | "siteLock"
  | "system"
  | "discordBot"
  | "combatValues"
  | "entityStats"
  | "memberChangelog"
  | "logs"
  | "memberAccessLogs"
  | "droidbrainUploads"
  | "toolStore";

type NavItem = {
  key: AdminView;
  label: string;
  hidden?: boolean;
};

type Props = {
  activeView: AdminView;
  onChange: (view: AdminView) => void;
  showSystemTools: boolean;
  canSeeLogs: boolean;
};

const AdminNav: React.FC<Props> = ({
  activeView,
  onChange,
  showSystemTools,
  canSeeLogs,
}) => {
  const items: NavItem[] = [
    { key: "home", label: "Overview" },
    { key: "workerHealth", label: "Worker Health", hidden: !showSystemTools },
    { key: "websiteHealth", label: "Website Health", hidden: !showSystemTools },
    { key: "tips", label: "Tips" },
    { key: "tenets", label: "Tenets" },
    { key: "eotm", label: "EoTM" },
    { key: "weather", label: "Weather" },
    { key: "users", label: "Users" },
    { key: "discordBot", label: "Discord Bot", hidden: !showSystemTools },
    { key: "siteLock", label: "Site Lock", hidden: !showSystemTools },
    { key: "system", label: "System", hidden: !showSystemTools },
    { key: "combatValues", label: "Combat Values", hidden: !showSystemTools },
    { key: "entityStats", label: "Entity Stats", hidden: !showSystemTools },
    { key: "memberChangelog", label: "Change Log" },
    { key: "droidbrainUploads", label: "DroidBrain Uploads", hidden: !showSystemTools },
    { key: "toolStore", label: "Tools Store", hidden: !showSystemTools },
    { key: "logs", label: "Action Logs", hidden: !canSeeLogs },
    { key: "memberAccessLogs", label: "Member Access", hidden: !canSeeLogs },
  ];

  const visible = items.filter((item) => !item.hidden);

  if (isMobile) {
    return (
      <div className="panel admin-nav">
        <select
          className="input"
          value={activeView}
          onChange={(e) => onChange(e.target.value as AdminView)}
        >
          {visible.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="panel admin-nav">
      <div className="admin-nav__list">
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              "btn admin-nav__btn" +
              (activeView === item.key ? " admin-nav__btn--active" : "")
            }
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminNav;
