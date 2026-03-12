import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthMe, type SwcUser } from "../api/auth";
import {
  completeAssignment,
  completeJob,
  createJob,
  getJobs,
  joinJob,
  takeJob,
  type Job,
} from "../api/jobs";
import NotLoggedInState from "../components/common/NotLoggedInState";
import MembersNav, { type MembersView } from "../components/members/MembersNav";
import JobsSubnav, { type JobsView } from "../components/members/jobs/JobsSubnav";
import OpenJobsPanel from "../components/members/jobs/OpenJobsPanel";
import MyPostedJobsPanel from "../components/members/jobs/MyPostedJobsPanel";
import MyTakenJobsPanel from "../components/members/jobs/MyTakenJobsPanel";
import CreateJobPanel from "../components/members/jobs/CreateJobPanel";

import "../styles/main.sass";
import "../styles/_admin.sass";

const MembersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [membersView, setMembersView] = useState<MembersView>("overview");
  const [jobsView, setJobsView] = useState<JobsView>("open");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [authRes, jobsRes] = await Promise.all([fetchAuthMe(), getJobs()]);

        if (cancelled) return;

        setUser(authRes?.user ?? null);
        setJobs(jobsRes?.data ?? []);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load member tools");
          setUser(null);
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshJobs() {
    const res = await getJobs();
    setJobs(res.data);
  }

  const isLoggedIn = !!user;

  const openJobs = useMemo(() => jobs.filter((j) => j.status === "open"), [jobs]);

  const myPostedJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter((j) => j.created_by_user_id === user.id);
  }, [jobs, user]);

  const myTakenJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter(
      (j) =>
        j.assigned_to_user_id === user.id ||
        (j.assignments ?? []).some((a) => a.worker_user_id === user.id)
    );
  }, [jobs, user]);

  async function onCreate(payload: {
    title: string;
    description: string;
    job_mode: "single" | "multi" | "open_ended";
    pay_type: "fixed" | "per_day_hyper";
    reward_amount: number;
    bonus_amount: number;
    payer_subject_type: "user" | "faction";
  }) {
    await createJob(payload);
    setMembersView("jobs");
    setJobsView("open");
    await refreshJobs();
  }

  async function onTake(jobId: number) {
    await takeJob(jobId);
    await refreshJobs();
  }

  async function onJoin(jobId: number) {
    await joinJob(jobId);
    await refreshJobs();
  }

  async function onCompleteSingle(jobId: number) {
    await completeJob(jobId);
    await refreshJobs();
  }

  async function onCompleteAssignment(assignmentId: number) {
    await completeAssignment(assignmentId);
    await refreshJobs();
  }

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Member Tools</h1>
            <p className="small">Loading member tools…</p>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Member Tools</h1>
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access member tools."
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <h1>Member Tools</h1>
          <p className="small">Member tools live here. Jobs have their own sub-navigation.</p>

          <MembersNav activeView={membersView} onChange={setMembersView} />

          {membersView === "overview" && (
            <div className="panel">
              <h2>Overview</h2>
              <p className="small">Open jobs: {openJobs.length}</p>
              <p className="small">My posted jobs: {myPostedJobs.length}</p>
              <p className="small">My taken jobs: {myTakenJobs.length}</p>
            </div>
          )}

          {membersView === "jobs" && (
            <>
              <JobsSubnav activeView={jobsView} onChange={setJobsView} />

              {jobsView === "open" && (
                <OpenJobsPanel jobs={openJobs} onTake={onTake} onJoin={onJoin} />
              )}

              {jobsView === "posted" && <MyPostedJobsPanel jobs={myPostedJobs} />}

              {jobsView === "taken" && (
                <MyTakenJobsPanel
                  jobs={myTakenJobs}
                  user={user}
                  onCompleteSingle={onCompleteSingle}
                  onCompleteAssignment={onCompleteAssignment}
                />
              )}

              {jobsView === "create" && <CreateJobPanel onCreate={onCreate} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default MembersPage;