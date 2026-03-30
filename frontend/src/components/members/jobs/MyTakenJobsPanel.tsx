import React, { useState } from "react";
import type { Job } from "../../../api/jobs";
import type { SwcUser } from "../../../api/auth";

type Props = {
  jobs: Job[];
  user: SwcUser;
  onCompleteSingle: (jobId: number, daysTaken?: number) => Promise<void>;
  onCompleteAssignment: (assignmentId: number, daysTaken?: number) => Promise<void>;
};

const MyTakenJobsPanel: React.FC<Props> = ({
  jobs,
  user,
  onCompleteSingle,
  onCompleteAssignment,
}) => {
  const [daysByKey, setDaysByKey] = useState<Record<string, string>>({});

  const readDaysTaken = (key: string): number | undefined => {
    const raw = (daysByKey[key] ?? "").trim();
    if (raw === "") {
      return undefined;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }

    return Math.floor(value);
  };

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
          <p className="small">
            Reward: {job.reward_amount.toLocaleString()}
            {job.bonus_amount > 0 ? ` · Bonus available: ${job.bonus_amount.toLocaleString()}` : ""}
          </p>

          {job.job_mode === "single" && job.assigned_to_user_id === user.id && job.status === "assigned" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              {job.pay_type === "per_day_hyper" && (
                <label className="small" style={{ display: "grid", gap: 4 }}>
                  Days completed
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={daysByKey[`job:${job.id}`] ?? ""}
                    onChange={(event) =>
                      setDaysByKey((current) => ({
                        ...current,
                        [`job:${job.id}`]: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </label>
              )}
              <button
                className="btn"
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
                <div
                  key={assignment.id}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}
                >
                  {job.pay_type === "per_day_hyper" && (
                    <label className="small" style={{ display: "grid", gap: 4 }}>
                      Days completed
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        value={daysByKey[`assignment:${assignment.id}`] ?? ""}
                        onChange={(event) =>
                          setDaysByKey((current) => ({
                            ...current,
                            [`assignment:${assignment.id}`]: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </label>
                  )}
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      onCompleteAssignment(
                        assignment.id,
                        readDaysTaken(`assignment:${assignment.id}`)
                      )
                    }
                  >
                    Complete Assignment
                  </button>
                </div>
              ))}
        </div>
      ))}
    </div>
  );
};

export default MyTakenJobsPanel;
