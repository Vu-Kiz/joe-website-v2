import React from "react";
import type { Job } from "../../../api/jobs";
import type { SwcUser } from "../../../api/auth";

type Props = {
  jobs: Job[];
  user: SwcUser;
  onCompleteSingle: (jobId: number) => Promise<void>;
  onCompleteAssignment: (assignmentId: number) => Promise<void>;
};

const MyTakenJobsPanel: React.FC<Props> = ({
  jobs,
  user,
  onCompleteSingle,
  onCompleteAssignment,
}) => {
  return (
    <div className="panel">
      <h2>My Taken Jobs</h2>

      {jobs.length === 0 && <p className="small">You have not taken any jobs.</p>}

      {jobs.map((job) => (
        <div key={job.id} className="admin-card" style={{ marginBottom: 12 }}>
          <strong>{job.title}</strong>
          <p className="small">{job.description ?? "No description"}</p>
          <p className="small">
            Status: {job.status} · Mode: {job.job_mode} · Pay type: {job.pay_type}
          </p>

          {job.job_mode === "single" && job.assigned_to_user_id === user.id && job.status === "assigned" && (
            <button className="btn" onClick={() => onCompleteSingle(job.id)}>
              Mark Complete
            </button>
          )}

          {job.job_mode === "multi" &&
            (job.assignments ?? [])
              .filter((a) => a.worker_user_id === user.id && a.status === "in_progress")
              .map((assignment) => (
                <button
                  key={assignment.id}
                  className="btn"
                  onClick={() => onCompleteAssignment(assignment.id)}
                  style={{ marginRight: 8 }}
                >
                  Complete Assignment
                </button>
              ))}
        </div>
      ))}
    </div>
  );
};

export default MyTakenJobsPanel;