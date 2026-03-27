import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin, type SwcUser } from "../api/auth";
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
import OpenJobsPanel from "../components/members/jobs/OpenJobsPanel";
import MyPostedJobsPanel from "../components/members/jobs/MyPostedJobsPanel";
import MyTakenJobsPanel from "../components/members/jobs/MyTakenJobsPanel";
import CreateJobPanel from "../components/members/jobs/CreateJobPanel";
import MembersUniversePanel from "../components/members/MembersUniversePanel";
import jawaLogo from "../assets/branding/jawalogo.png";
import astrogationIcon from "../assets/members/AstrogationIcon.png";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";

import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";

type MembersView = "overview" | "jobs" | "universe";
type JobsView = "open" | "posted" | "taken" | "create";
type MembersToolCard = {
  key: string;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
};

const MembersPage: React.FC = () => {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedMembersView = searchParams.get("members_view");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [membersView, setMembersView] = useState<MembersView>(
    location.state?.membersView === "universe" || requestedMembersView === "universe"
      ? "universe"
      : "overview"
  );
  const [jobsView, setJobsView] = useState<JobsView>("open");

  useEffect(() => {
    if (location.state?.membersView === "universe" || requestedMembersView === "universe") {
      setMembersView("universe");
    }
  }, [location.state, requestedMembersView]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [authRes, jobsRes, swcAuthRes] = await Promise.all([
          fetchAuthMe(),
          getJobs(),
          getSwcAuthorizationStatus(),
        ]);

        if (cancelled) return;

        setUser(authRes?.user ?? null);
        setJobs(jobsRes?.data ?? []);
        setSwcAuth(swcAuthRes?.data ?? null);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load member tools");
          setUser(null);
          setSwcAuth(null);
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

  function handleResyncSwcAccess() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    const savedPreferences = swcAuth?.member_tool_preferences;
    const selectedTools = [
      savedPreferences?.galaxy !== false ? "galaxy" : null,
      savedPreferences?.payments !== false ? "payments" : null,
    ].filter((value): value is string => value !== null);

    const query = new URLSearchParams({
      return_to: "/members",
      ...(selectedTools.length > 0 ? { tools: selectedTools.join(",") } : {}),
    });

    window.location.href = `${backendOrigin}/oauth/member-tools?${query.toString()}`;
  }

  const memberTools = useMemo<MembersToolCard[]>(
    () => [
      {
        key: "jobs",
        title: "Jobs",
        description: (
          <>
            Browse jobs, track your work, and create new requests. Open jobs:{" "}
            <span className="members-tool-card__count">{openJobs.length}</span>. Taken jobs:{" "}
            <span className="members-tool-card__count">{myTakenJobs.length}</span>.
          </>
        ),
        actionLabel: "Open Jobs",
        onClick: () => setMembersView("jobs"),
      },
      {
        key: "universe",
        title: "Astrogation",
        description: "Open the astrogation map, browse intel, and pull your SWC travel events.",
        actionLabel: "Open Astrogation",
        onClick: () => setMembersView("universe"),
      },
      {
        key: "swc-access",
        title: "SWC Access",
        description: (
          <>
            Reconnect member tool access if Astrogation or Payments times out. Status:{" "}
            <span className="members-tool-card__count">
              {swcAuth?.member_tools_connected ? "Connected" : "Not connected"}
            </span>
            .
          </>
        ),
        actionLabel: swcAuth?.member_tools_connected ? "Resync Access" : "Connect Access",
        onClick: handleResyncSwcAccess,
      },
    ],
    [myTakenJobs.length, openJobs.length, swcAuth?.member_tools_connected]
  );

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
      <main className="board admin-board members-page-shell">
        <h1>Member Tools</h1>
        <p className="small">Loading member tools…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="board admin-board members-page-shell">
        <h1>Member Tools</h1>
        <p className="small" style={{ color: "salmon" }}>
          {error}
        </p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="board admin-board members-page-shell">
        <NotLoggedInState
          title="Not logged in"
          message="You need to sign in to access member tools."
        />
      </main>
    );
  }

  return (
    <main className="board admin-board members-page-shell">
      <h1>Member Tools</h1>
      <p className="small">Member tools live here. Pick a tool card to jump straight in.</p>

      {membersView === "overview" && (
        <>
          <section className="members-tool-grid">
            {memberTools.map((tool) => (
              <article key={tool.key} className="members-tool-card">
                <img
                  src={tool.key === "universe" ? astrogationIcon : jawaLogo}
                  alt={tool.key === "universe" ? "Astrogation" : "JOE placeholder logo"}
                  className="members-tool-card__logo"
                />
                <div className="members-tool-card__body">
                  <h2 className="members-tool-card__title">{tool.title}</h2>
                  <p className="small members-tool-card__copy">{tool.description}</p>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={tool.onClick}
                >
                  {tool.actionLabel}
                </button>
              </article>
            ))}
          </section>
        </>
      )}

      {membersView === "jobs" && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>

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

      {membersView === "universe" && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MembersUniversePanel />
        </>
      )}
    </main>
  );
};

export default MembersPage;
