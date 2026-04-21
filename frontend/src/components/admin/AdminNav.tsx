import React from "react";

export type AdminView =
  | "home"
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
  | "memberAccessLogs";

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
    { key: "logs", label: "Action Logs", hidden: !canSeeLogs },
    { key: "memberAccessLogs", label: "Member Access", hidden: !canSeeLogs },
  ];

  return (
    <div className="panel admin-nav">
      <div className="admin-nav__list">
        {items
          .filter((item) => !item.hidden)
          .map((item) => (
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
