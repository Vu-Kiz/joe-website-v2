import React from "react";

export type JobsView = "open" | "posted" | "taken" | "create";

type Props = {
  activeView: JobsView;
  onChange: (view: JobsView) => void;
};

const JobsSubnav: React.FC<Props> = ({ activeView, onChange }) => {
  const items: Array<{ key: JobsView; label: string }> = [
    { key: "open", label: "Open Jobs" },
    { key: "posted", label: "My Posted Jobs" },
    { key: "taken", label: "My Taken Jobs" },
    { key: "create", label: "Create Job" },
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

export default JobsSubnav;