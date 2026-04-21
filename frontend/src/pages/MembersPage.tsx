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
import { canAccessCombatCalculator, canAccessIntel, canAccessMembers, canAccessPayments, canAccessSysadmin, canAccessWreckingHelperExtension } from "../auth/permissions";
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
import MemberGalacticArchivePanel from "../components/members/MemberGalacticArchivePanel";
import MemberCombatCalculatorPanel from "../components/members/MemberCombatCalculatorPanel";
import MemberWeaponHeatmapPanel from "../components/members/MemberWeaponHeatmapPanel";
import MemberWreckingHelperPanel from "../components/members/MemberWreckingHelperPanel";
import MemberRoleChangelogPanel from "../components/members/MemberRoleChangelogPanel";
import PrivilegePreviewPanel, {
  toPreviewPrivs,
  type PreviewPrivs,
} from "../components/members/PrivilegePreviewPanel";
import HamburgerToggle from "../components/common/HamburgerToggle";
import jawaLogo from "../assets/branding/jawalogo.png";
import archiveIcon from "../assets/members/ArchiveIcon.png";
import astrogationIcon from "../assets/members/AstrogationIcon.png";
import chainCodeIcon from "../assets/members/ChainCodeIcon.png";
import combatCalcIcon from "../assets/members/CombatCalcIcon.png";
import droidBrainIcon from "../assets/members/DroidBrainIcon.png";
import heatmapIcon from "../assets/members/HeatmapIcon.png";
import hyperIcon from "../assets/members/HyperIcon.png";
import jobBoardIcon from "../assets/members/JobBoardIcon.png";
import paymentIcon from "../assets/members/PaymentIcon.png";
import statsIcon from "../assets/members/StatsIcon.png";
import wreckerIcon from "../assets/members/WreckerIcon.png";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";
import { logMemberToolOpen, type MemberToolArea } from "../api/memberTools";

import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";

type MembersView = "overview" | "jobs" | "universe" | "stats" | "hyperplanner" | "archive" | "shipHeatmap" | "weaponHeatmap" | "wreckingHelper" | "changelog";
type JobsView = "open" | "posted" | "taken" | "create";
type MembersToolCard = {
  key: string;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
};

function parseMembersView(value: string | null): MembersView | null {
  switch (value) {
    case "overview":
    case "jobs":
    case "universe":
    case "stats":
    case "hyperplanner":
    case "archive":
    case "shipHeatmap":
    case "weaponHeatmap":
    case "wreckingHelper":
    case "changelog":
      return value;
    default:
      return null;
  }
}

const MembersPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedMembersView = parseMembersView(searchParams.get("members_view"));
  const requestedChangelogVersion = searchParams.get("changelog_version");
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
  const [toolkitPrivPreviewOpen, setToolkitPrivPreviewOpen] = useState(false);
  const [toolkitPreviewPrivs, setToolkitPreviewPrivs] = useState<PreviewPrivs>(() => toPreviewPrivs(null));

  const [membersView, setMembersView] = useState<MembersView>(
    Number.isFinite(requestedJobId) && requestedJobId > 0
      ? "jobs"
      : requestedMembersView ?? (location.state?.membersView === "universe" ? "universe" : "overview")
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
    if (requestedMembersView) {
      setMembersView(requestedMembersView);
      return;
    }

    if (location.state?.membersView === "universe") {
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
    const nextParams = new URLSearchParams(searchParams.toString());

    if (membersView === "overview") {
      nextParams.delete("members_view");
      nextParams.delete("jobs_view");
      nextParams.delete("job_id");
      nextParams.delete("changelog_version");
    } else {
      nextParams.set("members_view", membersView);

      if (membersView === "jobs") {
        nextParams.set("jobs_view", jobsView);
        if (selectedJobId) {
          nextParams.set("job_id", String(selectedJobId));
        } else {
          nextParams.delete("job_id");
        }
      } else {
        nextParams.delete("jobs_view");
        nextParams.delete("job_id");
      }

      if (membersView !== "changelog") {
        nextParams.delete("changelog_version");
      }
    }

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();
    if (currentQuery === nextQuery) {
      return;
    }

    navigate(
      {
        pathname: "/members",
        search: nextQuery ? `?${nextQuery}` : "",
      },
      { replace: true }
    );
  }, [jobsView, membersView, navigate, searchParams, selectedJobId]);

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
    setToolkitPreviewPrivs(toPreviewPrivs(user));
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const areaByView: Partial<Record<MembersView, MemberToolArea>> = {
      jobs: "jobs",
      universe: "astrogation",
      stats: "entity_stats",
      hyperplanner: "hyper_planner",
      archive: "galactic_archive",
    };

    const area = areaByView[membersView];
    if (!area) {
      return;
    }

    void logMemberToolOpen(area, "/members").catch(() => {});
  }, [membersView, user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        let authRes = await fetchAuthMe();
        let currentUser = authRes?.user ?? null;

        // Guard against transient auth races right after deploy/refresh where
        // the first auth/me can briefly resolve to null.
        if (!currentUser) {
          await new Promise((resolve) => window.setTimeout(resolve, 180));
          authRes = await fetchAuthMe();
          currentUser = authRes?.user ?? null;
        }

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
  const canSeeMembers = canAccessMembers(user) || canAccessIntel(user) || canAccessWreckingHelperExtension(user);
  const canSeeMemberOnlyTools = canAccessMembers(user);
  const canSeeGalacticArchive = canAccessSysadmin(user);
  const canSeeCombatCalculator = canAccessCombatCalculator(user);
  const canSeeWreckingHelperExtension = canAccessWreckingHelperExtension(user);
  const canSeeToolkitPrivilegePreview = canAccessSysadmin(user);
  const previewCardPrivs = canSeeToolkitPrivilegePreview ? toolkitPreviewPrivs : toPreviewPrivs(user);
  const showAdminCard = previewCardPrivs.isAdmin || previewCardPrivs.isSysadmin;
  const showMemberToolCards = previewCardPrivs.isJoeMember || previewCardPrivs.isAdmin || previewCardPrivs.isSysadmin;
  const showPaymentsCard = previewCardPrivs.isJoeMember || previewCardPrivs.isAdmin || previewCardPrivs.isSysadmin;
  const showDroidBrainCard = previewCardPrivs.isJoeMember || previewCardPrivs.isIntel || previewCardPrivs.isSysadmin;
  const showWreckingHelperCard = previewCardPrivs.canAccessWreckingHelper || previewCardPrivs.isAdmin || previewCardPrivs.isSysadmin;
  const showCombatCalculatorCard = previewCardPrivs.canAccessCombatCalc || previewCardPrivs.isAdmin || previewCardPrivs.isSysadmin;
  const showGalacticArchiveCard = previewCardPrivs.isSysadmin;

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
      ...(showAdminCard
        ? [
            {
              key: "admin",
              title: "Admin",
              description:
                "Open the admin control area for site operations, health checks, moderation, and system tooling.",
              actionLabel: "Open Admin",
              onClick: () => navigate("/admin"),
            } satisfies MembersToolCard,
          ]
        : []),
      ...(showMemberToolCards
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
      ...(showPaymentsCard
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
      ...(showDroidBrainCard
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
      ...(showWreckingHelperCard
        ? [
            {
              key: "wreckingHelper",
              title: "Wrecking Helper",
              description:
                "Download the extension package, then manage the shared prefix setting used by the extension.",
              actionLabel: "Open Wrecking Helper",
              onClick: () => setMembersView("wreckingHelper"),
            } satisfies MembersToolCard,
          ]
        : []),
      ...(showMemberToolCards
        ? [
            {
              key: "changelog",
              title: "Change Log",
              description:
                "See patch notes filtered to the tools and permissions available on your account.",
              actionLabel: "Open Change Log",
              onClick: () => setMembersView("changelog"),
            } satisfies MembersToolCard,
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
              key: "archive",
              title: "Galactic Archive",
              description:
                "Browse pulled SWC reference data for sectors, systems, planets, and faction ownership in one archive view.",
              actionLabel: "Open Galactic Archive",
              onClick: () => setMembersView("archive"),
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
              key: "shipHeatmap",
              title: "Combat Calculator",
              description:
                "Pick attacker and target ships, test expected engagement ranges, and inspect the combat board while the calculator is still being verified.",
              actionLabel: "Open Combat Calculator",
              onClick: () => setMembersView("shipHeatmap"),
            } satisfies MembersToolCard,
            {
              key: "weaponHeatmap",
              title: "Targeting Heatmap",
              description:
                "Test firing arcs, approach angles, and hit chance in a cleaner targeting sandbox.",
              actionLabel: "Open Targeting Heatmap",
              onClick: () => setMembersView("weaponHeatmap"),
            } satisfies MembersToolCard,
            {
              key: "universe",
              title: "Astrogation",
              description: "Open the astrogation map, browse intel, and pull your SWC travel events.",
              actionLabel: "Open Astrogation",
              onClick: () => setMembersView("universe"),
            } satisfies MembersToolCard,
          ]
            .filter((tool) => tool.key !== "archive" || showGalacticArchiveCard)
            .filter((tool) => tool.key !== "shipHeatmap" || showCombatCalculatorCard)
        : []),
    ],
    [
      showAdminCard,
      showMemberToolCards,
      showPaymentsCard,
      showDroidBrainCard,
      showWreckingHelperCard,
      showCombatCalculatorCard,
      showGalacticArchiveCard,
      hasPendingPayments,
      myTakenJobs.length,
      navigate,
      openJobs.length,
      swcAuth?.member_tools_connected,
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
        <h1>Tool Kit</h1>
        <p className="small">Loading tool kit…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="board admin-board members-page-shell">
        <h1>Tool Kit</h1>
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
          message="You need to sign in to access tools."
        />
      </main>
    );
  }

  if (!canSeeMembers) {
    return (
      <main className="board admin-board members-page-shell">
        <ForbiddenState
          title="403 Forbidden"
          message="You do not have permission to access tools."
        />
      </main>
    );
  }

  return (
    <main className="board admin-board members-page-shell">
      <h1>Tool Kit</h1>
      {membersView === "overview" ? (
        <p className="small">Tools live here. Pick a tool card to jump straight in.</p>
      ) : null}

      {membersView === "overview" && (
        <>
          {canSeeToolkitPrivilegePreview ? (
            <section className="panel members-toolkit-priv-preview">
              <div className="members-toolkit-priv-preview__head">
                <div>
                  <h2 className="members-toolkit-priv-preview__title">Privilege Preview</h2>
                  <p className="small members-toolkit-priv-preview__copy">
                    Sysadmin-only toolkit access simulator. Hidden by default.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--small members-toolkit-priv-preview__toggle"
                  onClick={() => setToolkitPrivPreviewOpen((open) => !open)}
                >
                  <span>{toolkitPrivPreviewOpen ? "Hide" : "Open"}</span>
                  <HamburgerToggle
                    open={toolkitPrivPreviewOpen}
                    ariaLabel={toolkitPrivPreviewOpen ? "Collapse privilege preview" : "Expand privilege preview"}
                    decorative
                  />
                </button>
              </div>

              {toolkitPrivPreviewOpen ? (
                <PrivilegePreviewPanel
                  value={toolkitPreviewPrivs}
                  onChange={setToolkitPreviewPrivs}
                  onReset={() => setToolkitPreviewPrivs(toPreviewPrivs(user))}
                  title="Toolkit Privileges"
                />
              ) : null}
            </section>
          ) : null}

          <section className="members-tool-grid">
            {memberTools.map((tool) => (
              <article key={tool.key} className="members-tool-card">
                <img
                  src={
                    tool.key === "universe"
                      ? astrogationIcon
                      : tool.key === "wreckingHelper"
                        ? wreckerIcon
                      : tool.key === "changelog"
                        ? archiveIcon
                      : tool.key === "shipHeatmap"
                        ? combatCalcIcon
                      : tool.key === "weaponHeatmap"
                        ? heatmapIcon
                      : tool.key === "hyperplanner"
                        ? hyperIcon
                        : tool.key === "archive"
                          ? archiveIcon
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
                      : tool.key === "wreckingHelper"
                        ? "Wrecking Helper"
                      : tool.key === "changelog"
                        ? "Change Log"
                      : tool.key === "shipHeatmap"
                        ? "Combat Calculator"
                      : tool.key === "weaponHeatmap"
                        ? "Targeting Heatmap"
                      : tool.key === "hyperplanner"
                        ? "Hyper Planner"
                      : tool.key === "archive"
                        ? "Galactic Archive"
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

      {membersView === "hyperplanner" && (
        <HyperPlannerPanel
          onBack={() => setMembersView("overview")}
          canRefreshStoredHyperlanes={canAccessSysadmin(user)}
        />
      )}

      {membersView === "shipHeatmap" && canSeeCombatCalculator && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberCombatCalculatorPanel />
        </>
      )}

      {membersView === "weaponHeatmap" && canSeeMemberOnlyTools && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberWeaponHeatmapPanel />
        </>
      )}

      {membersView === "stats" && canSeeMemberOnlyTools && (
        <>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberEntityStatsPanel />
        </>
      )}

      {membersView === "archive" && canSeeGalacticArchive && (
        <MemberGalacticArchivePanel onBack={() => setMembersView("overview")} />
      )}

      {membersView === "wreckingHelper" && canSeeWreckingHelperExtension && (
        <MemberWreckingHelperPanel onBack={() => setMembersView("overview")} />
      )}

      {membersView === "changelog" && (
        <MemberRoleChangelogPanel
          user={user}
          initialVersionFilter={requestedChangelogVersion}
          onBack={() => setMembersView("overview")}
        />
      )}
    </main>
  );
};

export default MembersPage;
