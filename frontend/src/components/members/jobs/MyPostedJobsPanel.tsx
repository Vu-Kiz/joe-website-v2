import React from "react";
import type { Job } from "../../../api/jobs";

type Props = {
  jobs: Job[];
};

const MyPostedJobsPanel: React.FC<Props> = ({ jobs }) => {
  return (
    <div className="panel">
      <h2>My Posted Jobs</h2>

      {jobs.length === 0 && <p className="small">You have not posted any jobs.</p>}

      {jobs.map((job) => (
        <div key={job.id} className="admin-card" style={{ marginBottom: 12 }}>
          <strong>{job.title}</strong>
          <p className="small">{job.description ?? "No description"}</p>
          <p className="small">
            Status: {job.status} · Mode: {job.job_mode} · Reward: {job.reward_amount.toLocaleString()}
          </p>
          <p className="small">Assigned to: {job.assigned_to_handle ?? "-"}</p>
        </div>
      ))}
    </div>
  );
};

export default MyPostedJobsPanel;