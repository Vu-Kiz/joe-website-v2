import React from "react";
import type { Job } from "../../../api/jobs";

type Props = {
  jobs: Job[];
  onTake: (jobId: number) => Promise<void>;
  onJoin: (jobId: number) => Promise<void>;
  onViewDetails: (jobId: number) => void;
};

const OpenJobsPanel: React.FC<Props> = ({ jobs, onTake, onJoin, onViewDetails }) => {
  return (
    <div className="panel">
      <h2>Open Jobs</h2>

      {jobs.length === 0 && <p className="small">No open jobs.</p>}

      {jobs.map((job) => (
        <div key={job.id} className="admin-card" style={{ marginBottom: 12 }}>
          <strong>{job.title}</strong>
          <p className="small">{job.description ?? "No description"}</p>
          <p className="small">
            Mode: {job.job_mode} · Pay type: {job.pay_type} · Reward: {job.reward_amount.toLocaleString()}
          </p>
          <p className="small">Payer: {job.payer_label ?? "-"}</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" onClick={() => onViewDetails(job.id)}>
              View Details
            </button>

            {job.job_mode === "single" && (
              <button className="btn" type="button" onClick={() => onTake(job.id)}>
                Take Job
              </button>
            )}

            {job.job_mode === "multi" && (
              <button className="btn" type="button" onClick={() => onJoin(job.id)}>
                Join Job
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OpenJobsPanel;
