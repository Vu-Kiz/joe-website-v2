import React from "react";
import type { DroidBrainTab } from "../../api/droidbrain";

type Props = {
  activeTab: DroidBrainTab;
  tabLabels: Record<DroidBrainTab, string>;
  onSelect: (tab: DroidBrainTab) => void;
};

const DroidBrainTabs: React.FC<Props> = ({ activeTab, tabLabels, onSelect }) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
    {Object.entries(tabLabels).map(([key, label]) => (
      <button
        key={key}
        className={`btn ${activeTab === key ? "active" : ""}`}
        type="button"
        onClick={() => onSelect(key as DroidBrainTab)}
      >
        {label}
      </button>
    ))}
  </div>
);

export default DroidBrainTabs;
