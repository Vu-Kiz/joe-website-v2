import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import {
  completeAssignment,
  completeJob,
  createJob,
  getJobs,
  joinJob,
  setAssignmentBonus,
  setJobBonus,
  takeJob,
  type Job,
} from "../api/jobs";
import { getPayments } from "../api/payments";
import { getMyPayableFactions, type PayableFaction } from "../api/factions";
import { canAccessDroidBrain, canAccessIntel, canAccessMembers, canAccessPayments } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import OpenJobsPanel from "../components/members/jobs/OpenJobsPanel";
import MyPostedJobsPanel from "../components/members/jobs/MyPostedJobsPanel";
import MyTakenJobsPanel from "../components/members/jobs/MyTakenJobsPanel";
import CreateJobPanel from "../components/members/jobs/CreateJobPanel";
import JobsSubnav from "../components/members/jobs/JobsSubnav";
import MembersUniversePanel from "../components/members/MembersUniversePanel";
import MemberEntityStatsPanel from "../components/members/MemberEntityStatsPanel";
import HyperPlannerPanel from "../components/members/HyperPlannerPanel";
import jawaLogo from "../assets/branding/jawalogo.png";
import astrogationIcon from "../assets/members/AstrogationIcon.png";
import chainCodeIcon from "../assets/members/ChainCodeIcon.png";
import droidBrainIcon from "../assets/members/DroidBrainIcon.png";
import hyperIcon from "../assets/members/HyperIcon.png";
import jobBoardIcon from "../assets/members/JobBoardIcon.png";
import paymentIcon from "../assets/members/PaymentIcon.png";
import statsIcon from "../assets/members/StatsIcon.png";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";

import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";

type MembersView = "overview" | "jobs" | "universe" | "stats" | "hyperplanner";
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
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedMembersView = searchParams.get("members_view");
  const requestedJobsView = searchParams.get("jobs_view");
  const requestedJobId = Number(searchParams.get("job_id") ?? "");
  const swcOauthSuccess = searchParams.get("swc_oauth_success") === "1";
  const swcOauthError = searchParams.get("swc_oauth_error");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payableFactions, setPayableFactions] = useState<PayableFaction[]>([]);
  const [hasPendingPayments, setHasPendingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);

  const [membersView, setMembersView] = useState<MembersView>(
    Number.isFinite(requestedJobId) && requestedJobId > 0
      ? "jobs"
      : location.state?.membersView === "universe" || requestedMembersView === "universe"
      ? "universe"
      : "overview"
  );
  const [jobsView, setJobsView] = useState<JobsView>(
    requestedJobsView === "posted" || requestedJobsView === "taken" || requestedJobsView === "create"
      ? requestedJobsView
      : "open"
  );
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    Number.isFinite(requestedJobId) && requestedJobId > 0 ? requestedJobId : null
  );

  useEffect(() => {
    if (location.state?.membersView === "universe" || requestedMembersView === "universe") {
      setMembersView("universe");
    }
  }, [location.state, requestedMembersView]);

  useEffect(() => {
    if (Number.isFinite(requestedJobId) && requestedJobId > 0) {
      setMembersView("jobs");
      setSelectedJobId(requestedJobId);
    }
  }, [requestedJobId]);

  useEffect(() => {
    if (requestedJobsView === "posted" || requestedJobsView === "taken" || requestedJobsView === "create") {
      setJobsView(requestedJobsView);
      return;
    }

    if (requestedMembersView === "jobs") {
      setJobsView("open");
    }
  }, [requestedJobsView, requestedMembersView]);

  useEffect(() => {
    if (!swcOauthSuccess && !swcOauthError) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("swc_oauth_success");
    nextParams.delete("swc_oauth_error");

    const nextQuery = nextParams.toString();
    navigate(
      {
        pathname: "/members",
        search: nextQuery ? `?${nextQuery}` : "",
      },
      { replace: true }
    );
  }, [navigate, searchParams, swcOauthError, swcOauthSuccess]);

  useEffect(() => {
    return subscribeToAuthStateChange(() => {
      setAuthRefreshNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const authRes = await fetchAuthMe();
        const currentUser = authRes?.user ?? null;
        const canSeeMemberTools = canAccessMembers(currentUser);
        const canSeeDroidBrain = canAccessIntel(currentUser);

        if (cancelled) return;

        setUser(currentUser);

        if (!currentUser) {
          setJobs([]);
          setSwcAuth(null);
          setPayableFactions([]);
          setHasPendingPayments(false);
          setError(null);
          return;
        }

        if (!canSeeMemberTools && !canSeeDroidBrain) {
          setJobs([]);
          setSwcAuth(null);
          setPayableFactions([]);
          setHasPendingPayments(false);
          setError(null);
          return;
        }

        const [jobsRes, swcAuthRes, payableFactionsRes, paymentsRes] = await Promise.all([
          canSeeMemberTools ? getJobs() : Promise.resolve({ data: [] }),
          canSeeMemberTools ? getSwcAuthorizationStatus() : Promise.resolve({ data: null }),
          canSeeMemberTools ? getMyPayableFactions() : Promise.resolve({ data: [] }),
          canAccessPayments(currentUser) ? getPayments() : Promise.resolve({ data: [] }),
        ]);

        if (cancelled) return;

        setJobs(jobsRes?.data ?? []);
        setSwcAuth(swcAuthRes?.data ?? null);
        setPayableFactions(payableFactionsRes?.data ?? []);
        setHasPendingPayments((paymentsRes?.data?.length ?? 0) > 0);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load member tools");
          setUser(null);
          setSwcAuth(null);
          setJobs([]);
          setPayableFactions([]);
          setHasPendingPayments(false);
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
  }, [authRefreshNonce]);

  async function refreshJobs() {
    const res = await getJobs();
    setJobs(res.data);
  }

  const isLoggedIn = !!user;
  const canSeeMembers = canAccessMembers(user) || canAccessIntel(user);
  const canSeeMemberOnlyTools = canAccessMembers(user);

  const openJobs = useMemo(() => jobs.filter((j) => j.status === "open"), [jobs]);

  const myPostedJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter((j) => j.created_by_user_id === user.id);
  }, [jobs, user]);

  const myTakenJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter(
      (j) =>
        (j.job_mode === "single" &&
          j.status === "assigned" &&
          j.assigned_to_user_id === user.id) ||
        (j.job_mode === "multi" &&
          (j.assignments ?? []).some(
            (a) => a.worker_user_id === user.id && a.status === "in_progress"
          ))
    );
  }, [jobs, user]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) {
      return null;
    }

    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  function openJobDetails(jobId: number, nextJobsView: JobsView = "open") {
    setMembersView("jobs");
    setJobsView(nextJobsView);
    setSelectedJobId(jobId);

    navigate(
      {
        pathname: "/members",
        search: `?members_view=jobs&jobs_view=${nextJobsView}&job_id=${jobId}`,
      },
      { replace: false }
    );
  }

  function clearSelectedJob() {
    setSelectedJobId(null);
    navigate(
      {
        pathname: "/members",
        search: "?members_view=jobs",
      },
      { replace: false }
    );
  }

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
      ...(canSeeMemberOnlyTools
        ? [
            {
              key: "swc-access",
              title: "Chain Code Verification",
              description: (
                <>
                  Reconnect Chain Code Verification if Astrogation or Payments times out. Status:{" "}
                  <span className="members-tool-card__count">
                    {swcAuth?.member_tools_connected ? "Connected" : "Not connected"}
                  </span>
                  .
                </>
              ),
              actionLabel: swcAuth?.member_tools_connected ? "Resync Verification" : "Connect Verification",
              onClick: handleResyncSwcAccess,
            } satisfies MembersToolCard,
          ]
        : []),
      ...(canAccessPayments(user)
        ? [
            {
              key: "payments",
              title: "Payments",
              description: (
                <>
                  Open pending payments, payment history, and manual templates. Status:{" "}
                  <span className="members-tool-card__count">{hasPendingPayments ? "Pending items" : "Clear"}</span>.
                </>
              ),
              actionLabel: "Open Payments",
              onClick: () => navigate("/payments"),
            } satisfies MembersToolCard,
          ]
        : []),
      ...(canAccessDroidBrain(user)
        ? [
            {
              key: "droidbrain",
              title: "DroidBrain",
              description:
                "Browse recorded intel, scan reports, and archived sightings from the DroidBrain network.",
              actionLabel: "Open DroidBrain",
              onClick: () => navigate("/intel/droidbrain"),
            } satisfies MembersToolCard,
          ]
        : []),
      ...(canSeeMemberOnlyTools
        ? [
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
            } satisfies MembersToolCard,
            {
              key: "stats",
              title: "Entity Stats",
              description:
                "Browse stored ships, stations, planets, materials, and other SWC catalog stats in a cleaner viewer.",
              actionLabel: "Open Entity Stats",
              onClick: () => setMembersView("stats"),
            } satisfies MembersToolCard,
            {
              key: "hyperplanner",
              title: "Hyper Planner",
              description:
                "Plot stored hyperlane routes between systems and jump straight into the linked system pages.",
              actionLabel: "Open Hyper Planner",
              onClick: () => setMembersView("hyperplanner"),
            } satisfies MembersToolCard,
            {
              key: "universe",
              title: "Astrogation",
              description: "Open the astrogation map, browse intel, and pull your SWC travel events.",
              actionLabel: "Open Astrogation",
              onClick: () => setMembersView("universe"),
            } satisfies MembersToolCard,
          ]
        : []),
    ],
    [
      canSeeMemberOnlyTools,
      hasPendingPayments,
      myTakenJobs.length,
      navigate,
      openJobs.length,
      swcAuth?.member_tools_connected,
      user,
    ]
  );

  async function onCreate(payload: {
    title: string;
    description: string;
    job_mode: "single" | "multi" | "open_ended";
    pay_type: "fixed" | "per_day_hyper";
    reward_amount: number;
    bonus_amount: number;
    payer_subject_type: "user" | "faction";
    payer_subject_id?: number | null;
  }) {
    await createJob(payload);
    setMembersView("jobs");
    setJobsView("posted");
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

  async function onCompleteSingle(jobId: number, daysTaken?: number) {
    await completeJob(jobId, daysTaken, false);
    await refreshJobs();
  }

  async function onCompleteAssignment(assignmentId: number, daysTaken?: number) {
    await completeAssignment(assignmentId, daysTaken, false);
    await refreshJobs();
  }

  async function onSetJobBonus(jobId: number, includeBonus: boolean) {
    await setJobBonus(jobId, includeBonus);
    await refreshJobs();
  }

  async function onSetAssignmentBonus(assignmentId: number, includeBonus: boolean) {
    await setAssignmentBonus(assignmentId, includeBonus);
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

  if (!canSeeMembers) {
    return (
      <main className="board admin-board members-page-shell">
        <ForbiddenState
          title="403 Forbidden"
          message="You do not have permission to access member tools."
        />
      </main>
    );
  }

  return (
    <main className="board admin-board members-page-shell">
      <h1>Member Tools</h1>
      {membersView === "overview" ? (
        <p className="small">Member tools live here. Pick a tool card to jump straight in.</p>
      ) : null}

      {membersView === "overview" && (
        <>
          <section className="members-tool-grid">
            {memberTools.map((tool) => (
              <article key={tool.key} className="members-tool-card">
                <img
                  src={
                    tool.key === "universe"
                      ? astrogationIcon
                      : tool.key === "hyperplanner"
                        ? hyperIcon
                        : tool.key === "stats"
                          ? statsIcon
                      : tool.key === "jobs"
                        ? jobBoardIcon
                      : tool.key === "payments"
                        ? paymentIcon
                      : tool.key === "droidbrain"
                        ? droidBrainIcon
                      : tool.key === "swc-access"
                        ? chainCodeIcon
                        : jawaLogo
                  }
                  alt={
                    tool.key === "universe"
                      ? "Astrogation"
                      : tool.key === "hyperplanner"
                        ? "Hyper Planner"
                      : tool.key === "stats"
                        ? "Entity Stats"
                      : tool.key === "jobs"
                        ? "Job Board"
                      : tool.key === "payments"
                        ? "Payments"
                      : tool.key === "droidbrain"
                        ? "DroidBrain"
                      : tool.key === "swc-access"
                        ? "Chain Code Verification"
                        : "JOE placeholder logo"
                  }
                  className={`members-tool-card__logo${tool.key === "payments" && hasPendingPayments ? " members-tool-card__logo--alert" : ""}`}
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

          {selectedJobId && (
            <div className="panel" style={{ marginBottom: 12 }}>
              {selectedJob ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2 style={{ marginTop: 0, marginBottom: 6 }}>{selectedJob.title}</h2>
                      <p className="small" style={{ margin: 0 }}>
                        Job #{selectedJob.id} · Status: {selectedJob.status} · Mode: {selectedJob.job_mode}
                      </p>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={clearSelectedJob}>
                      Close Details
                    </button>
                  </div>

                  <p className="small" style={{ marginTop: 12 }}>
                    {selectedJob.description ?? "No description"}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                  >
                    <div className="admin-card">
                      <p className="small" style={{ margin: 0 }}>
                        Reward: {selectedJob.reward_amount.toLocaleString()}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        Pay type: {selectedJob.pay_type}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        Payer: {selectedJob.payer_label ?? "-"}
                      </p>
                    </div>

                    <div className="admin-card">
                      <p className="small" style={{ margin: 0 }}>
                        Posted by: {selectedJob.created_by_handle}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        Assigned to: {selectedJob.assigned_to_handle ?? "-"}
                      </p>
                      {selectedJob.bonus_amount > 0 && (
                        <p className="small" style={{ margin: "6px 0 0" }}>
                          Bonus: {selectedJob.bonus_amount.toLocaleString()}
                          {selectedJob.bonus_reward ? ` · ${selectedJob.bonus_reward}` : ""}
                          {!selectedJob.bonus_reward && selectedJob.bonus_note ? ` · ${selectedJob.bonus_note}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="small" style={{ margin: 0 }}>
                  That job could not be found.
                </p>
              )}
            </div>
          )}

          <JobsSubnav activeView={jobsView} onChange={setJobsView} />

          {jobsView === "open" && (
            <OpenJobsPanel
              jobs={openJobs}
              onTake={onTake}
              onJoin={onJoin}
              onViewDetails={(jobId) => openJobDetails(jobId, "open")}
            />
          )}

          {jobsView === "posted" && (
            <MyPostedJobsPanel
              jobs={myPostedJobs}
              onSetJobBonus={onSetJobBonus}
              onSetAssignmentBonus={onSetAssignmentBonus}
            />
          )}

          {jobsView === "taken" && (
            <MyTakenJobsPanel
              jobs={myTakenJobs}
              user={user}
              onCompleteSingle={onCompleteSingle}
              onCompleteAssignment={onCompleteAssignment}
            />
          )}

          {jobsView === "create" && (
            <CreateJobPanel
              onCreate={onCreate}
              personalPayerLabel={user?.handle ?? "Unknown"}
              payableFactions={payableFactions}
            />
          )}
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

      {membersView === "hyperplanner" && <HyperPlannerPanel onBack={() => setMembersView("overview")} />}

      {membersView === "stats" && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberEntityStatsPanel />
        </>
      )}
    </main>
  );
};

export default MembersPage;
