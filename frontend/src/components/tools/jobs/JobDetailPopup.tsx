import React from "react";
import type { Job } from "../../../api/jobs/jobs";
import { fmtCreditsFull as fmt } from "../../../utils/credits";

type Props = {
  job: Job;
  onClose: () => void;
  actions?: React.ReactNode;
};

const modeBadgeLabel: Record<string, string> = {
  single: "Single",
  multi: "Multi",
  open_ended: "Open Ended",
};

const badgeBase = "inline-block px-2 py-[0.15rem] rounded-full text-[0.7rem] uppercase tracking-[0.05em]";
const statusBadgeCls: Record<string, string> = {
  open:      `${badgeBase} bg-[rgba(46,204,113,0.15)] text-[#8fe1a8]`,
  assigned:  `${badgeBase} bg-[rgba(245,213,70,0.15)] text-[#f5d546]`,
  completed: `${badgeBase} bg-[rgba(255,255,255,0.08)] opacity-50`,
};
const defaultBadgeCls = `${badgeBase} bg-[rgba(255,255,255,0.08)]`;

const POPUP_ROW = "flex items-baseline gap-2 justify-between";

const JobDetailPopup: React.FC<Props> = ({ job, onClose, actions }) => {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65" onClick={onClose}>
      <div
        className="relative flex flex-col gap-4 w-[calc(100vw-2rem)] max-w-[480px] max-h-[90vh] overflow-y-auto p-5 rounded-[12px] border border-white/[0.12] bg-[#1a1c22] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-3 top-3 bg-white/[0.06] hover:bg-white/10 hover:text-white/90 border-0 rounded-[6px] text-white/50 text-[0.85rem] px-2 py-1 cursor-pointer font-tektur"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >✕</button>

        <div className="flex items-start gap-4 pr-8">
          <div className="flex flex-col gap-[0.2rem] min-w-0">
            <p className="m-0 text-[1rem] font-semibold leading-[1.3] break-words">{job.title}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <span className={statusBadgeCls[job.status] ?? defaultBadgeCls}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
              {modeBadgeLabel[job.job_mode] && (
                <span className={defaultBadgeCls}>{modeBadgeLabel[job.job_mode]}</span>
              )}
              {job.pay_type === "per_day_hyper" && (
                <span className={defaultBadgeCls}>Per day in hyper</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
          {job.description && (
            <p className="small" style={{ margin: 0 }}>{job.description}</p>
          )}
          <div className={POPUP_ROW}>
            <span className="small muted">Reward</span>
            <span className="font-bold text-[#f5d546] text-[0.9rem]">{fmt(job.reward_amount)}</span>
          </div>
          {job.bonus_amount > 0 && (
            <div className={POPUP_ROW}>
              <span className="small muted">Bonus</span>
              <span className="text-[0.78rem] opacity-65">+{fmt(job.bonus_amount)}</span>
            </div>
          )}
          <div className={POPUP_ROW}>
            <span className="small muted">Payer</span>
            <span className="small">{job.payer_label ?? "—"}</span>
          </div>
          {job.assigned_to_handle && (
            <div className={POPUP_ROW}>
              <span className="small muted">Assigned to</span>
              <span className="small">{job.assigned_to_handle}</span>
            </div>
          )}
          {job.job_mode === "multi" && (job.assignments ?? []).length > 0 && (
            <div>
              <p className="small muted" style={{ margin: "0 0 4px" }}>Workers</p>
              {job.assignments!.map((a) => (
                <p key={a.id} className="small" style={{ margin: "2px 0" }}>
                  {a.worker_handle ?? `#${a.worker_user_id}`}
                  {" — "}
                  <span style={{ opacity: 0.65 }}>{a.status}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {actions && (
          <div className="flex gap-2 border-t border-white/[0.07] pt-3">{actions}</div>
        )}
      </div>
    </div>
  );
};

export default JobDetailPopup;
