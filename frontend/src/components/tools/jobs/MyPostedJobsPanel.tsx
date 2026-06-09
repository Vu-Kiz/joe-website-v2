import React, { useState } from "react";
import type { Job } from "../../../api/jobs/jobs";
import JobDetailPopup from "./JobDetailPopup";
import { fmtCreditsFull as fmt } from "../../../utils/credits";
import { BTN_SM, BTN_GHOST_SM } from "../../../utils/ui";

type Props = {
  jobs: Job[];
  onSetJobBonus: (jobId: number, includeBonus: boolean) => Promise<void>;
  onSetAssignmentBonus: (assignmentId: number, includeBonus: boolean) => Promise<void>;
  onDeleteJob: (jobId: number) => Promise<void>;
};

const badgeBase = "inline-block px-2 py-[0.15rem] rounded-full text-[0.7rem] uppercase tracking-[0.05em]";
const statusBadgeCls: Record<string, string> = {
  open:      `${badgeBase} bg-[rgba(46,204,113,0.15)] text-[#8fe1a8]`,
  assigned:  `${badgeBase} bg-[rgba(245,213,70,0.15)] text-[#f5d546]`,
  completed: `${badgeBase} bg-[rgba(255,255,255,0.08)] opacity-50`,
};
const defaultBadgeCls = `${badgeBase} bg-[rgba(255,255,255,0.08)]`;

const MyPostedJobsPanel: React.FC<Props> = ({ jobs, onSetJobBonus, onSetAssignmentBonus, onDeleteJob }) => {
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const readBonusDecision = (meta?: Record<string, unknown> | null): boolean | null => {
    if (!meta || !Object.prototype.hasOwnProperty.call(meta, "bonus_awarded")) return null;
    const value = meta.bonus_awarded;
    return typeof value === "boolean" ? value : null;
  };

  return (
    <div className="panel">
      <h2 className="h2">My Posted Jobs</h2>
      {jobs.length === 0 && <p className="small">You have not posted any jobs.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mt-2">
        {jobs.map((job) => (
          <div key={job.id} className="flex flex-col gap-[0.6rem] p-4 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] font-tektur">
            <div className="flex items-center flex-wrap gap-2 cursor-pointer" onClick={() => setDetailJob(job)}>
              <p className="m-0 text-[0.95rem] font-bold">{job.title}</p>
              <div className="flex gap-[0.4rem] flex-wrap items-center">
                <span className={statusBadgeCls[job.status] ?? defaultBadgeCls}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
                <span className={defaultBadgeCls}>{job.job_mode.replace("_", " ")}</span>
              </div>
            </div>

            <div className="flex items-center gap-[0.6rem] flex-wrap cursor-pointer" onClick={() => setDetailJob(job)}>
              <span className="font-bold text-[#f5d546] text-[0.9rem]">{fmt(job.reward_amount)}</span>
              {job.bonus_amount > 0 && (
                <span className="text-[0.78rem] opacity-65">+{fmt(job.bonus_amount)} bonus</span>
              )}
              {job.assigned_to_handle && (
                <span className="text-[0.78rem] opacity-55">{job.assigned_to_handle}</span>
              )}
            </div>

            {job.status === "open" && (
              <div className="flex gap-2 flex-wrap mt-1">
                {confirmDeleteId === job.id ? (
                  <>
                    <span className="small" style={{ opacity: 0.75, alignSelf: "center" }}>Delete this job?</span>
                    <button className={BTN_SM} type="button" style={{ color: "salmon" }} onClick={() => { onDeleteJob(job.id); setConfirmDeleteId(null); }}>
                      Confirm Delete
                    </button>
                    <button className={BTN_GHOST_SM} type="button" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className={BTN_GHOST_SM} type="button" style={{ color: "salmon" }} onClick={() => setConfirmDeleteId(job.id)}>
                    Delete
                  </button>
                )}
              </div>
            )}

            {job.job_mode === "single" && job.status === "completed" && job.bonus_amount > 0 && (
              <div className="flex gap-2 flex-wrap mt-1">
                <span className="small" style={{ opacity: 0.65 }}>
                  Bonus:{" "}
                  {readBonusDecision(job.meta) === null
                    ? "Pending decision"
                    : readBonusDecision(job.meta)
                      ? "Awarded"
                      : "Not awarded"}
                </span>
                <button className={BTN_SM} type="button" onClick={() => onSetJobBonus(job.id, true)}>Award Bonus</button>
                <button className={BTN_GHOST_SM} type="button" onClick={() => onSetJobBonus(job.id, false)}>No Bonus</button>
              </div>
            )}

            {job.job_mode === "multi" && job.bonus_amount > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {(job.assignments ?? [])
                  .filter((a) => a.status === "completed")
                  .map((assignment) => (
                    <div key={assignment.id} className="flex gap-2 flex-wrap mt-1">
                      <span className="small" style={{ opacity: 0.65 }}>
                        {assignment.worker_handle}:{" "}
                        {readBonusDecision(assignment.meta) === null
                          ? "Pending"
                          : readBonusDecision(assignment.meta)
                            ? "Bonus awarded"
                            : "No bonus"}
                      </span>
                      <button className={BTN_SM} type="button" onClick={() => onSetAssignmentBonus(assignment.id, true)}>Award</button>
                      <button className={BTN_GHOST_SM} type="button" onClick={() => onSetAssignmentBonus(assignment.id, false)}>No Bonus</button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {detailJob && (
        <JobDetailPopup job={detailJob} onClose={() => setDetailJob(null)} />
      )}
    </div>
  );
};

export default MyPostedJobsPanel;
