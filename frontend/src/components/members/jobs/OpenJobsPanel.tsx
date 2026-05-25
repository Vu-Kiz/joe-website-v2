import React, { useEffect, useState } from "react";
import type { Job } from "../../../api/jobs/jobs";
import JobDetailPopup from "./JobDetailPopup";
import { fmtCreditsFull as fmt } from "../../../utils/credits";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM } from "../../../utils/ui";

type Props = {
  jobs: Job[];
  onTake: (jobId: number) => Promise<void>;
  onJoin: (jobId: number) => Promise<void>;
  initialJobId?: number | null;
  onInitialJobConsumed?: () => void;
};

const OpenJobsPanel: React.FC<Props> = ({ jobs, onTake, onJoin, initialJobId, onInitialJobConsumed }) => {
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!initialJobId || jobs.length === 0) return;
    const job = jobs.find((j) => j.id === initialJobId);
    if (job) {
      setDetailJob(job);
      setConfirming(false);
      onInitialJobConsumed?.();
    }
  }, [initialJobId, jobs]);

  return (
    <div className="panel">
      <h2 className="h2">Open Jobs</h2>
      {jobs.length === 0 && <p className="small">No open jobs right now.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mt-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex flex-col gap-[0.6rem] p-4 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] cursor-pointer font-tektur"
            onClick={() => { setDetailJob(job); setConfirming(false); }}
          >
            <div className="flex items-center flex-wrap gap-2">
              <p className="m-0 text-[0.95rem] font-bold">{job.title}</p>
              <span className="inline-block px-2 py-[0.15rem] rounded-full text-[0.7rem] uppercase tracking-[0.05em] bg-[rgba(46,204,113,0.15)] text-[#8fe1a8]">
                Open
              </span>
            </div>
            <div className="flex items-center gap-[0.6rem] flex-wrap">
              <span className="font-bold text-[#f5d546] text-[0.9rem]">{fmt(job.reward_amount)}</span>
              {job.bonus_amount > 0 && (
                <span className="text-[0.78rem] opacity-65">+{fmt(job.bonus_amount)} bonus</span>
              )}
              <span className="text-[0.78rem] opacity-55">{job.payer_label ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>

      {detailJob && (
        <JobDetailPopup
          job={detailJob}
          onClose={() => { setDetailJob(null); setConfirming(false); }}
          actions={
            confirming ? (
              <>
                <span className="small" style={{ opacity: 0.75, alignSelf: "center" }}>Are you sure?</span>
                <button
                  className={BTN_SM}
                  type="button"
                  onClick={() => { detailJob.job_mode === "single" ? onTake(detailJob.id) : onJoin(detailJob.id); setDetailJob(null); setConfirming(false); }}
                >
                  Confirm
                </button>
                <button className={BTN_GHOST_SM} type="button" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {detailJob.job_mode === "single" && (
                  <button className={BTN_SM} type="button" onClick={() => setConfirming(true)}>
                    Take Job
                  </button>
                )}
                {detailJob.job_mode === "multi" && (
                  <button className={BTN_SM} type="button" onClick={() => setConfirming(true)}>
                    Join Job
                  </button>
                )}
              </>
            )
          }
        />
      )}
    </div>
  );
};

export default OpenJobsPanel;
