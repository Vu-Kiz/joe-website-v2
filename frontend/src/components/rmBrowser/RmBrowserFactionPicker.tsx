import React from "react";

const FACTIONS = [
  { uid: "1376", label: "JOE" },
  { uid: "1791", label: "GARRY" },
  { uid: "1796", label: "RAID" },
] as const;

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const RmBrowserFactionPicker: React.FC<Props> = ({ selected, onChange, disabled }) => {
  function toggle(uid: string) {
    if (selected.includes(uid)) {
      onChange(selected.filter((f) => f !== uid));
    } else {
      onChange([...selected, uid]);
    }
  }

  return (
    <div className="rm-browser__faction-picker">
      {FACTIONS.map(({ uid, label }) => (
        <label key={uid} className={`rm-browser__faction-chip${selected.includes(uid) ? " is-active" : ""}`}>
          <input
            type="checkbox"
            checked={selected.includes(uid)}
            onChange={() => toggle(uid)}
            disabled={disabled}
          />
          {label}
        </label>
      ))}
    </div>
  );
};

export default RmBrowserFactionPicker;
