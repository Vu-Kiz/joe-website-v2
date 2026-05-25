import React from "react";
import { Link } from "react-router-dom";
import { BTN } from "../../utils/ui";

type UniverseDetailHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  backLabel?: string;
  backTo?: string;
  backState?: unknown;
};

const UniverseDetailHero: React.FC<UniverseDetailHeroProps> = ({
  eyebrow,
  title,
  meta,
  backLabel = "Back to Astrogation",
  backTo = "/tools",
  backState = { membersView: "universe" },
}) => {
  return (
    <section className="panel flex flex-col gap-4 p-[1.25rem] border-[rgba(246,163,0,0.12)] bg-[linear-gradient(135deg,rgba(26,30,34,0.94),rgba(18,21,24,0.94))]">
      <div className="grid gap-[0.55rem]">
        <span className="text-[0.72rem] font-bold tracking-[0.12em] uppercase text-[rgba(246,163,0,0.88)]">{eyebrow}</span>
        <h1 className="m-0 text-[clamp(1.8rem,3vw,2.7rem)] leading-[1.05]">{title}</h1>
        {meta ? (
          <div className="flex flex-wrap gap-[0.65rem] [&_span]:py-[0.4rem] [&_span]:px-[0.65rem] [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.08] [&_span]:bg-white/[0.04] [&_span]:text-white/[0.84] [&_span]:text-[0.84rem]">
            {meta}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Link className={BTN} to={backTo} state={backState}>
          {backLabel}
        </Link>
      </div>
    </section>
  );
};

export default UniverseDetailHero;
