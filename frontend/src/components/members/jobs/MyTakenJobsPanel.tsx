import React, { useState } from "react";
import type { Job } from "../../../api/jobs/jobs";
import type { SwcUser } from "../../../api/core/auth";
import JobDetailPopup from "./JobDetailPopup";
import { fmtCreditsFull as fmt } from "../../../utils/credits";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM, INPUT} from "../../../utils/ui";

type Props = {
  jobs: Job[];
  user: SwcUser;
  onCompleteSingle: (jobId: number, daysTaken?: number) => Promise<void>;
  onCompleteAssignment: (assignmentId: number, daysTaken?: number) => Promise<void>;
};

const MyTakenJobsPanel: React.FC<Props> = ({ jobs, user, onCompleteSingle, onCompleteAssignment }) => {
  const [daysByKey, setDaysByKey] = useState<Record<string, string>>({});
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const readDaysTaken = (key: string): number | undefined => {
    const raw = (daysByKey[key] ?? "").trim();
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.floor(value);
  };

  return (
    <div className="panel">
      <h2 className="h2">My Taken Jobs</h2>
      {jobs.length === 0 && <p className="small">You have not taken any jobs.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mt-2">
        {jobs.map((job) => (
          <div key={job.id} className="flex flex-col gap-[0.6rem] p-4 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] font-tektur">
            <div className="flex items-center flex-wrap gap-2 cursor-pointer" onClick={() => setDetailJob(job)}>
              <p className="m-0 text-[0.95rem] font-bold">{job.title}</p>
              <span className="inline-block px-2 py-[0.15rem] rounded-full text-[0.7rem] uppercase tracking-[0.05em] bg-[rgba(245,213,70,0.15)] text-[#f5d546]">
                In Progress
              </span>
            </div>
            <div className="flex items-center gap-[0.6rem] flex-wrap cursor-pointer" onClick={() => setDetailJob(job)}>
              <span className="font-bold text-[#f5d546] text-[0.9rem]">{fmt(job.reward_amount)}</span>
              {job.bonus_amount > 0 && (
                <span className="text-[0.78rem] opacity-65">+{fmt(job.bonus_amount)} bonus</span>
              )}
              <span className="text-[0.78rem] opacity-55">{job.payer_label ?? "—"}</span>
            </div>

            {job.job_mode === "single" && job.assigned_to_user_id === user.id && job.status === "assigned" && (
              <div className="flex flex-col items-start gap-2 mt-1">
                {job.pay_type === "per_day_hyper" && (
                  <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Days in hyper
                    <input
                      className={INPUT}
                      type="number"
                      min="0"
                      step="1"
                      value={daysByKey[`job:${job.id}`] ?? ""}
                      onChange={(e) => setDaysByKey((c) => ({ ...c, [`job:${job.id}`]: e.target.value }))}
                      placeholder="0"
                      style={{ width: 72 }}
                    />
                  </label>
                )}
                <button
                  className={BTN_SM}
                  type="button"
                  onClick={() => onCompleteSingle(job.id, readDaysTaken(`job:${job.id}`))}
                >
                  Mark Complete
                </button>
              </div>
            )}

            {job.job_mode === "multi" &&
              (job.assignments ?? [])
                .filter((a) => a.worker_user_id === user.id && a.status === "in_progress")
                .map((assignment) => (
                  <div key={assignment.id} className="flex flex-col items-start gap-2 mt-1">
                    {job.pay_type === "per_day_hyper" && (
                      <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        Days in hyper
                        <input
                          className={INPUT}
                          type="number"
                          min="0"
                          step="1"
                          value={daysByKey[`assignment:${assignment.id}`] ?? ""}
                          onChange={(e) =>
                            setDaysByKey((c) => ({ ...c, [`assignment:${assignment.id}`]: e.target.value }))
                          }
                          placeholder="0"
                          style={{ width: 72 }}
                        />
                      </label>
                    )}
                    <button
                      className={BTN_SM}
                      type="button"
                      onClick={() => onCompleteAssignment(assignment.id, readDaysTaken(`assignment:${assignment.id}`))}
                    >
                      Complete Assignment
                    </button>
                  </div>
                ))}
          </div>
        ))}
      </div>

      {detailJob && (
        <JobDetailPopup job={detailJob} onClose={() => setDetailJob(null)} />
      )}
    </div>
  );
};

export default MyTakenJobsPanel;
