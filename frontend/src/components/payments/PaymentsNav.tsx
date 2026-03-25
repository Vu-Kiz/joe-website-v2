import type { PaymentsView } from "./types";

type Props = {
  activeView: PaymentsView;
  onChange: (view: PaymentsView) => void;
};

const PaymentsNav = ({ activeView, onChange }: Props) => {
  const items: Array<{ key: PaymentsView; label: string }> = [
    { key: "pending", label: "Pending" },
    { key: "owed", label: "Owed To Me" },
    { key: "history", label: "History" },
    { key: "templates", label: "Manual Templates" },
  ];

  return (
    <div className="panel admin-nav">
      <div className="admin-nav__list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              "btn admin-nav__btn" +
              (activeView === item.key ? " admin-nav__btn--active" : "")
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
