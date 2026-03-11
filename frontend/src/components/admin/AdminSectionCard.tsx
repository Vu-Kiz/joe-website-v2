import React from "react";

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
    <section className="panel admin-card">
      <div className="admin-card__header">
        <h2 className="admin-card__title">{title}</h2>
        {description && <p className="small admin-card__desc">{description}</p>}
      </div>

      <div className="admin-card__actions">
        <button type="button" className="btn" onClick={onOpen}>
          {buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default AdminSectionCard;