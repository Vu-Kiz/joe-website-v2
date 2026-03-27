import React from "react";

export type MembersView = "overview" | "jobs" | "universe";

type Props = {
  activeView: MembersView;
  onChange: (view: MembersView) => void;
};

const MembersNav: React.FC<Props> = ({ activeView, onChange }) => {
  const items: Array<{ key: MembersView; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "jobs", label: "Jobs" },
    { key: "universe", label: "Astrogation" },
  ];

  return (
    <div className="panel admin-nav">
      <div className="admin-nav__list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={"btn admin-nav__btn" + (activeView === item.key ? " admin-nav__btn--active" : "")}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MembersNav;
