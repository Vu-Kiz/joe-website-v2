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
    <div className="flex gap-2 flex-wrap">
      {FACTIONS.map(({ uid, label }) => {
        const isActive = selected.includes(uid);
        return (
          <label
            key={uid}
            className={`flex items-center gap-[6px] px-3 py-[5px] border rounded-[20px] text-[0.8rem] font-medium cursor-pointer transition-[background,border-color] duration-150 select-none ${
              isActive
                ? "bg-[rgba(255,193,7,0.15)] border-[rgba(255,193,7,0.5)] text-[#ffc107]"
                : "border-white/[0.15] opacity-60 hover:opacity-90 hover:border-white/30"
            }`}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => toggle(uid)}
              disabled={disabled}
              className="hidden"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
};

export default RmBrowserFactionPicker;
