import React from "react";

type UniverseDetailImmersiveProps = {
  title: React.ReactNode;
  toolbar?: React.ReactNode;
  copy?: React.ReactNode;
  viewport: React.ReactNode;
  selection: React.ReactNode;
};

const UniverseDetailImmersive: React.FC<UniverseDetailImmersiveProps> = ({
  title,
  toolbar,
  copy,
  viewport,
  selection,
}) => {
  return (
    <section className="panel admin-card members-universe-system__immersive">
      <div className="admin-card__header">
        <h3 className="admin-card__title">{title}</h3>
      </div>

      {toolbar ? toolbar : null}
      {copy ? <p className="small sysuniverse-copy-reset">{copy}</p> : null}

      <div className="members-universe-system__map-shell">
        {viewport}
        <aside className="members-universe-system__selection-panel">{selection}</aside>
      </div>
    </section>
  );
};

export default UniverseDetailImmersive;
