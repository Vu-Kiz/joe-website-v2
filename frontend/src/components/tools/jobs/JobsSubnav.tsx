import React from "react";
import SlideTabNav, { type TabItem } from "../../common/SlideTabNav";

export type JobsView = "open" | "posted" | "taken" | "create" | "payClaims";

type Props = {
  activeView: JobsView;
  onChange: (view: JobsView) => void;
};

const items: TabItem<JobsView>[] = [
  { key: "open",      label: "Open Jobs" },
  { key: "posted",    label: "My Posted" },
  { key: "taken",     label: "My Taken" },
  { key: "create",    label: "Create" },
  { key: "payClaims", label: "Pay Claims" },
];

const JobsSubnav: React.FC<Props> = ({ activeView, onChange }) => (
  <SlideTabNav items={items} activeKey={activeView} onChange={onChange} />
);

export default JobsSubnav;
