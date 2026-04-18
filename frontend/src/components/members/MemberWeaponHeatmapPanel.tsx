import React from "react";
import WeaponHeatmapTool from "../tools/weaponHeatmap/WeaponHeatmapTool";
import "../../styles/main.sass";
import "../../styles/_admin.sass";
import "../../styles/_weaponheatmap.sass";

const MemberWeaponHeatmapPanel: React.FC = () => {
  return (
    <WeaponHeatmapTool
      title="Targeting Heatmap"
      subtitle="Member-side sandbox for testing firing arcs, target approach angles, and hit chance before we fold this logic into broader combat tools."
    />
  );
};

export default MemberWeaponHeatmapPanel;
