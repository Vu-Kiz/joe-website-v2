import React from "react";
import type { DroidBrainTab } from "../../api/universe/droidbrain";
import SlideTabNav from "../common/SlideTabNav";

type Props = {
  activeTab: DroidBrainTab;
  tabLabels: Record<DroidBrainTab, string>;
  onSelect: (tab: DroidBrainTab) => void;
};

const DroidBrainTabs: React.FC<Props> = ({ activeTab, tabLabels, onSelect }) => {
  const items = Object.entries(tabLabels).map(([key, label]) => ({
    key: key as DroidBrainTab,
    label,
  }));

  return (
    <SlideTabNav
      items={items}
      activeKey={activeTab}
      onChange={onSelect}
    />
  );
};

export default DroidBrainTabs;
