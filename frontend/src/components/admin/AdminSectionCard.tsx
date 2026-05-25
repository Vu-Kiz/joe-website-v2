import React from "react";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM } from "../../utils/ui";

type Props = {
  title: string;
  description?: string;
  buttonLabel: string;
  onOpen: () => void;
};

const AdminSectionCard: React.FC<Props> = ({
  title,
  description,
  buttonLabel,
  onOpen,
}) => {
  return (
    <section className="panel !mb-0 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0">{title}</h2>
        {description && <p className="small m-0 opacity-85">{description}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={BTN} onClick={onOpen}>
          {buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default AdminSectionCard;
