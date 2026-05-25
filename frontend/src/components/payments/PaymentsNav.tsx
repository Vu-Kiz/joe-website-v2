import type { PaymentsView } from "./types";
import { BTN } from "../../utils/ui";

type Props = {
  activeView: PaymentsView;
  onChange: (view: PaymentsView) => void;
  showDroidBrain?: boolean;
};

const PaymentsNav = ({ activeView, onChange, showDroidBrain = false }: Props) => {
  const items: Array<{ key: PaymentsView; label: string }> = [
    { key: "pending", label: "Pending" },
    { key: "owed", label: "Owed To Me" },
    { key: "history", label: "History" },
    { key: "templates", label: "Manual Templates" },
  ];

  if (showDroidBrain) {
    items.push({ key: "droidbrain", label: "DroidBrain" });
  }

  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              BTN + " min-w-[120px]" +
              (activeView === item.key ? " border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "")
            }
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaymentsNav;
