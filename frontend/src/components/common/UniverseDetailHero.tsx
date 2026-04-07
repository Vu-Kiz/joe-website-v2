import React from "react";
import { Link } from "react-router-dom";

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
  backTo = "/members",
  backState = { membersView: "universe" },
}) => {
  return (
    <section className="members-universe-system__hero panel admin-card">
      <div className="members-universe-system__hero-copy">
        <span className="members-universe-system__eyebrow">{eyebrow}</span>
        <h1 className="members-universe-system__title">{title}</h1>
        {meta ? <div className="members-universe-system__hero-meta">{meta}</div> : null}
      </div>

      <div className="members-universe-system__hero-actions">
        <Link className="btn" to={backTo} state={backState}>
          {backLabel}
        </Link>
      </div>
    </section>
  );
};

export default UniverseDetailHero;
