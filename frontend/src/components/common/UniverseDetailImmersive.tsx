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
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">{title}</h3>
      </div>

      {toolbar ? toolbar : null}
      {copy ? <p className="small m-0">{copy}</p> : null}

      <div className="grid [grid-template-columns:minmax(0,1fr)_320px] gap-4 items-start">
        {viewport}
        <aside className="grid gap-3 p-[0.95rem] rounded-[12px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] min-w-0">
          {selection}
        </aside>
      </div>
    </section>
  );
};

export default UniverseDetailImmersive;
