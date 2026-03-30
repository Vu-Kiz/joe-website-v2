import React from "react";
import type { Job } from "../../../api/jobs";

type Props = {
  jobs: Job[];
  onSetJobBonus: (jobId: number, includeBonus: boolean) => Promise<void>;
  onSetAssignmentBonus: (assignmentId: number, includeBonus: boolean) => Promise<void>;
};

const MyPostedJobsPanel: React.FC<Props> = ({
  jobs,
  onSetJobBonus,
  onSetAssignmentBonus,
}) => {
  const readBonusDecision = (meta?: Record<string, unknown> | null): boolean | null => {
    if (!meta || !Object.prototype.hasOwnProperty.call(meta, "bonus_awarded")) {
      return null;
    }

    const value = meta.bonus_awarded;
    return typeof value === "boolean" ? value : null;
  };

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
          {job.bonus_amount > 0 && (
            <p className="small">Bonus available: {job.bonus_amount.toLocaleString()}</p>
          )}
          <p className="small">Assigned to: {job.assigned_to_handle ?? "-"}</p>

          {job.job_mode === "single" && job.status === "completed" && job.bonus_amount > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="small">
                Bonus status: {readBonusDecision(job.meta) === null
                  ? "Pending poster review"
                  : readBonusDecision(job.meta)
                    ? "Awarded"
                    : "Not awarded"}
              </span>
              <button className="btn" type="button" onClick={() => onSetJobBonus(job.id, true)}>
                Award Bonus
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => onSetJobBonus(job.id, false)}>
                No Bonus
              </button>
            </div>
          )}

          {job.job_mode === "multi" && job.bonus_amount > 0 && (
            <div style={{ marginTop: 8 }}>
              {(job.assignments ?? [])
                .filter((assignment) => assignment.status === "completed")
                .map((assignment) => (
                  <div
                    key={assignment.id}
                    style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}
                  >
                    <span className="small">
                      {assignment.worker_handle}: {readBonusDecision(assignment.meta) === null
                        ? "Pending poster review"
                        : readBonusDecision(assignment.meta)
                          ? "Bonus awarded"
                          : "No bonus"}
                    </span>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onSetAssignmentBonus(assignment.id, true)}
                    >
                      Award Bonus
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => onSetAssignmentBonus(assignment.id, false)}
                    >
                      No Bonus
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MyPostedJobsPanel;
