import React from "react";
import { BTN } from "../../utils/ui";

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
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={BTN + " min-w-[120px]" + (activeView === item.key ? " border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "")}
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
