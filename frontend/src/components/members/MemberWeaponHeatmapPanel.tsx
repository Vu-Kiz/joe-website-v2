import React from "react";
import WeaponHeatmapTool from "../tools/weaponHeatmap/WeaponHeatmapTool";

const MemberWeaponHeatmapPanel: React.FC = () => {
  return (
    <WeaponHeatmapTool
      title="Targeting Heatmap"
      subtitle="Member-side sandbox for testing firing arcs, target approach angles, and hit chance before we fold this logic into broader combat tools."
    />
  );
};

export default MemberWeaponHeatmapPanel;
