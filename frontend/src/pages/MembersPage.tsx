import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import {
  completeAssignment,
  completeJob,
  createJob,
  deleteJob,
  getJobs,
  joinJob,
  setAssignmentBonus,
  setJobBonus,
  takeJob,
  type Job,
} from "../api/jobs/jobs";
import { getPayments } from "../api/payments/payments";
import { getMyPayableFactions, type PayableFaction } from "../api/factions/factions";
import { canAccessAdmin, canAccessCombatCalculator, canAccessFleetCommander, canAccessIntel, canAccessMembers, canAccessPayments, canAccessPublicTools, canAccessRmBrowser, canAccessSysadmin, canAccessWreckingHelperExtension, getToolAccessTier } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import OpenJobsPanel from "../components/members/jobs/OpenJobsPanel";
import MyPostedJobsPanel from "../components/members/jobs/MyPostedJobsPanel";
import MyTakenJobsPanel from "../components/members/jobs/MyTakenJobsPanel";
import CreateJobPanel from "../components/members/jobs/CreateJobPanel";
import JobsSubnav from "../components/members/jobs/JobsSubnav";
import PayClaimsPanel from "../components/members/jobs/PayClaimsPanel";
import { getJobPayClaims } from "../api/jobs/jobPayRates";
import MemberEntityStatsPanel from "../components/members/MemberEntityStatsPanel";
import HyperPlannerPanel from "../components/members/HyperPlannerPanel";
import MemberGalacticArchivePanel from "../components/members/MemberGalacticArchivePanel";
import MemberCombatCalculatorPanel from "../components/members/MemberCombatCalculatorPanel";
import MemberWeaponHeatmapPanel from "../components/members/MemberWeaponHeatmapPanel";
import MemberWreckingHelperPanel from "../components/members/MemberWreckingHelperPanel";
import RmBrowserPanel from "../components/rmBrowser/RmBrowserPanel";
import MemberRoleChangelogPanel from "../components/members/MemberRoleChangelogPanel";
import MemberFleetCommandPanel from "../components/members/MemberFleetCommandPanel";
import PrivilegePreviewPanel, {
  toPreviewPrivs,
  type PreviewPrivs,
} from "../components/members/PrivilegePreviewPanel";
import HamburgerToggle from "../components/common/HamburgerToggle";
import jawaLogo from "../assets/branding/jawalogo.png";
import archiveIcon from "../assets/members/ArchiveIcon.png";
import astrogationIcon from "../assets/members/AstrogationIcon.png";
import biometricsIcon from "../assets/members/BiometricsIcon.png";
import chainCodeIcon from "../assets/members/ChainCodeIcon.png";
import changelogIcon from "../assets/members/ChangelogIcon.png";
import combatCalcIcon from "../assets/members/CombatCalcIcon.png";
import droidBrainIcon from "../assets/members/DroidBrainIcon.png";
import heatmapIcon from "../assets/members/HeatmapIcon.png";
import hyperIcon from "../assets/members/HyperIcon.png";
import jobBoardIcon from "../assets/members/JobBoardIcon.png";
import paymentIcon from "../assets/members/PaymentIcon.png";
import statsIcon from "../assets/members/StatsIcon.png";
import wreckerIcon from "../assets/members/WreckerIcon.png";
import rmIcon from "../assets/members/RMicon.png";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/members/swcAuthorization";
import { logMemberToolOpen, type MemberToolArea } from "../api/members/memberTools";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM } from "../utils/ui";
import ReportBugButton from "../components/support/ReportBugButton";

type MembersView = "overview" | "jobs" | "universe" | "stats" | "hyperplanner" | "biometrics" | "archive" | "shipHeatmap" | "weaponHeatmap" | "wreckingHelper" | "changelog" | "rmBrowser";
type JobsView = "open" | "posted" | "taken" | "create" | "payClaims";
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
    case "biometrics":
    case "archive":
    case "shipHeatmap":
    case "weaponHeatmap":
    case "wreckingHelper":
    case "changelog":
    case "rmBrowser":
      return value;
    case "fleetCommand":
    case "Biometrics":
      return "biometrics";
    default:
      return null;
  }
}

const MembersUniversePanel = React.lazy(() => import("../components/members/MembersUniversePanel"));
let prefetchedUniversePanel = false;

const MembersPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedMembersView = parseMembersView(searchParams.get("tools_view"));
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
  const [hasPendingClaims, setHasPendingClaims] = useState(false);
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
    requestedJobsView === "posted" || requestedJobsView === "taken" || requestedJobsView === "create" || requestedJobsView === "payClaims"
      ? requestedJobsView
      : "open"
  );
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    Number.isFinite(requestedJobId) && requestedJobId > 0 ? requestedJobId : null
  );
  const [mountUniversePanel, setMountUniversePanel] = useState<boolean>(requestedMembersView === "universe");
  const skipNextUrlSyncRef = useRef(false);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

  useEffect(() => {
    if (requestedMembersView) {
      setMembersView(requestedMembersView);
      return;
    }

    if (location.state?.resetToOverview) {
      skipNextUrlSyncRef.current = true;
      setMembersView("overview");
      return;
    }

    if (location.state?.membersView === "universe") {
      setMembersView("universe");
    }
  }, [location.state, requestedMembersView]);

  useEffect(() => {
    if (membersView !== "universe" || mountUniversePanel) {
      return;
    }

    const mountTimer = window.setTimeout(() => {
      setMountUniversePanel(true);
    }, 0);

    return () => {
      window.clearTimeout(mountTimer);
    };
  }, [membersView, mountUniversePanel]);

  useEffect(() => {
    if (prefetchedUniversePanel) {
      return;
    }

    const prefetch = () => {
      if (prefetchedUniversePanel) {
        return;
      }
      prefetchedUniversePanel = true;
      void import("../components/members/MembersUniversePanel");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (
        window as Window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number }
      ).requestIdleCallback(prefetch, { timeout: 1200 });

      return () => {
        if ("cancelIdleCallback" in window) {
          (
            window as Window & { cancelIdleCallback: (handle: number) => void }
          ).cancelIdleCallback(id);
        }
      };
    }

    const timeout = globalThis.setTimeout(prefetch, 350);
    return () => globalThis.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (Number.isFinite(requestedJobId) && requestedJobId > 0) {
      setMembersView("jobs");
      setSelectedJobId(requestedJobId);
    }
  }, [requestedJobId]);

  useEffect(() => {
    if (requestedJobsView === "posted" || requestedJobsView === "taken" || requestedJobsView === "create" || requestedJobsView === "payClaims") {
      setJobsView(requestedJobsView);
      return;
    }

    if (requestedMembersView === "jobs") {
      setJobsView("open");
    }
  }, [requestedJobsView, requestedMembersView]);

  useEffect(() => {
    if (skipNextUrlSyncRef.current) {
      skipNextUrlSyncRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (membersView === "overview") {
      nextParams.delete("tools_view");
      nextParams.delete("jobs_view");
      nextParams.delete("job_id");
      nextParams.delete("changelog_version");
    } else {
      nextParams.set("tools_view", membersView);

      if (membersView === "jobs") {
        nextParams.set("jobs_view", jobsView);
        nextParams.delete("job_id");
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
        pathname: "/tools",
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
        pathname: "/tools",
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
      biometrics: "fleet_command",
      archive: "galactic_archive",
    };

    const area = areaByView[membersView];
    if (!area) {
      return;
    }

    if (canSeeMemberOnlyTools) void logMemberToolOpen(area, "/tools").catch(() => {});
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
        const canSeePublicToolsNow = canAccessPublicTools(currentUser);

        if (cancelled) return;

        setUser(currentUser);

        if (!currentUser) {
          setJobs([]);
          setSwcAuth(null);
          setPayableFactions([]);
          setHasPendingPayments(false);
          setHasPendingClaims(false);
          setError(null);
          return;
        }

        if (!canSeeMemberTools && !canSeeDroidBrain && !canSeePublicToolsNow) {
          setJobs([]);
          setSwcAuth(null);
          setPayableFactions([]);
          setHasPendingPayments(false);
          setHasPendingClaims(false);
          setError(null);
          return;
        }

        const [jobsRes, swcAuthRes, payableFactionsRes, paymentsRes, pendingClaimsRes] = await Promise.all([
          canSeeMemberTools ? getJobs() : Promise.resolve({ data: [] }),
          (canSeeMemberTools || canSeePublicToolsNow) ? getSwcAuthorizationStatus() : Promise.resolve({ data: null }),
          canSeeMemberTools ? getMyPayableFactions() : Promise.resolve({ data: [] }),
          canAccessPayments(currentUser) ? getPayments() : Promise.resolve({ data: [] }),
          (currentUser?.is_admin || currentUser?.is_sysadmin) ? getJobPayClaims({ status: 'pending' }) : Promise.resolve({ data: [] }),
        ]);

        if (cancelled) return;

        setJobs(jobsRes?.data ?? []);
        setSwcAuth(swcAuthRes?.data ?? null);
        setPayableFactions(payableFactionsRes?.data ?? []);
        setHasPendingPayments((paymentsRes?.data?.length ?? 0) > 0);
        setHasPendingClaims((pendingClaimsRes?.data?.length ?? 0) > 0);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load member tools");
          setUser(null);
          setSwcAuth(null);
          setJobs([]);
          setPayableFactions([]);
          setHasPendingPayments(false);
          setHasPendingClaims(false);
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
  const canSeePublicTools = canAccessPublicTools(user);
  const toolAccessTier = getToolAccessTier(user);
  const canSeeMembers = canAccessMembers(user) || canAccessIntel(user) || canAccessWreckingHelperExtension(user) || canAccessFleetCommander(user) || canSeePublicTools;
  const canSeeMemberOnlyTools = canAccessMembers(user);
  const canSeeFleetCommander = canAccessFleetCommander(user);
  const canSeeRmBrowser = canAccessRmBrowser(user);
  const canSeeGalacticArchive = canAccessAdmin(user);
  const canSeeCombatCalculator = canAccessCombatCalculator(user);
  const canSeeWreckingHelperExtension = canAccessWreckingHelperExtension(user);
  const canSeeToolkitPrivilegePreview = canAccessSysadmin(user);
  const effectiveCardPrivs =
    canSeeToolkitPrivilegePreview && toolkitPrivPreviewOpen
      ? toolkitPreviewPrivs
      : toPreviewPrivs(user);
  const showAdminCard = effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showMemberToolCards = effectiveCardPrivs.isJoeMember || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showPublicToolCards = toolAccessTier === "public" && !showMemberToolCards;
  const showPaymentsCard = effectiveCardPrivs.isJoeMember || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showDroidBrainCard = effectiveCardPrivs.isJoeMember || effectiveCardPrivs.isIntel || effectiveCardPrivs.isSysadmin || showPublicToolCards;
  const showWreckingHelperCard = effectiveCardPrivs.canAccessWreckingHelper || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showFleetCommanderCard = effectiveCardPrivs.canAccessFleetCommander || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showRmBrowserCard = effectiveCardPrivs.canAccessRmBrowser || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showCombatCalculatorCard = effectiveCardPrivs.canAccessCombatCalc || effectiveCardPrivs.isAdmin || effectiveCardPrivs.isSysadmin;
  const showGalacticArchiveCard = effectiveCardPrivs.isSysadmin;

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
        pathname: "/tools",
        search: `?tools_view=jobs&jobs_view=${nextJobsView}&job_id=${jobId}`,
      },
      { replace: false }
    );
  }

  function clearSelectedJob() {
    setSelectedJobId(null);
    navigate(
      {
        pathname: "/tools",
        search: "?tools_view=jobs",
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
      savedPreferences?.fleet_command !== false ? "fleet_command" : null,
    ].filter((value): value is string => value !== null);

    const query = new URLSearchParams({
      return_to: "/tools",
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
                  <span className="font-extrabold text-amber-300">
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
                  <span className="font-extrabold text-amber-300">{hasPendingPayments ? "Pending items" : "Clear"}</span>.
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
      ...(showRmBrowserCard
        ? [
            {
              key: "rmBrowser",
              title: "RM Browser",
              description:
                "Browse and filter raw materials across JOE, GARRY, and RAID faction inventories by sector, system, and name.",
              actionLabel: "Open RM Browser",
              onClick: () => setMembersView("rmBrowser"),
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
                  <span className="font-extrabold text-amber-300">{openJobs.length}</span>. Taken jobs:{" "}
                  <span className="font-extrabold text-amber-300">{myTakenJobs.length}</span>.
                  {hasPendingClaims && (
                    <> Pay claims: <span className="font-extrabold text-amber-300">Pending</span>.</>
                  )}
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
              key: "biometrics",
              title: "Biometrics",
              description:
                "Filter members, inspect individual skill stats, and plan assignments with current SWC skill data.",
              actionLabel: "Open Biometrics",
              onClick: () => setMembersView("biometrics"),
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
            .filter((tool) => tool.key !== "biometrics" || showMemberToolCards)
            .filter((tool) => tool.key !== "shipHeatmap" || showCombatCalculatorCard)
        : []),
      ...(showPublicToolCards
        ? [
            {
              key: "universe",
              title: "Astrogation",
              description: "Open the galaxy map, browse system and planet data, and plan hyperspace routes.",
              actionLabel: "Open Astrogation",
              onClick: () => setMembersView("universe"),
            } satisfies MembersToolCard,
            {
              key: "stats",
              title: "Entity Stats",
              description: "Browse the full Star Wars Combine entity catalog with stats and comparisons.",
              actionLabel: "Open Entity Stats",
              onClick: () => setMembersView("stats"),
            } satisfies MembersToolCard,
            {
              key: "hyperplanner",
              title: "Hyper Planner",
              description: "Plot hyperspace routes across the galaxy.",
              actionLabel: "Open Hyper Planner",
              onClick: () => setMembersView("hyperplanner"),
            } satisfies MembersToolCard,
            {
              key: "weaponHeatmap",
              title: "Targeting Heatmap",
              description: "Test firing arcs, approach angles, and hit chance in the targeting sandbox.",
              actionLabel: "Open Targeting Heatmap",
              onClick: () => setMembersView("weaponHeatmap"),
            } satisfies MembersToolCard,
          ]
        : []),
    ],
    [
      showAdminCard,
      showMemberToolCards,
      showPublicToolCards,
      showPaymentsCard,
      showDroidBrainCard,
      showWreckingHelperCard,
      showFleetCommanderCard,
      showCombatCalculatorCard,
      showGalacticArchiveCard,
      showRmBrowserCard,
      hasPendingPayments,
      hasPendingClaims,
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

  async function onDeleteJob(jobId: number) {
    await deleteJob(jobId);
    await refreshJobs();
  }

  if (loading) {
    return (
      <main className="board flex flex-col gap-4">
        <h1 className="h1">Tool Kit</h1>
        <p className="small">Loading tool kit…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="board flex flex-col gap-4">
        <h1 className="h1">Tool Kit</h1>
        <p className="small" style={{ color: "salmon" }}>
          {error}
        </p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="board flex flex-col gap-4">
        <NotLoggedInState
          title="Not logged in"
          message="You need to sign in to access tools."
        />
      </main>
    );
  }

  if (!canSeeMembers) {
    return (
      <main className="board flex flex-col gap-4">
        <ForbiddenState
          title="403 Forbidden"
          message="You do not have permission to access tools."
        />
      </main>
    );
  }

  return (
    <main className="board flex flex-col gap-4 space-y-4">
      <h1 className="h1">Tool Kit</h1>
      {membersView === "overview" ? (
        <p className="small">Tools live here. Pick a tool card to jump straight in.</p>
      ) : null}

      {membersView === "overview" && (
        <section className="space-y-4">
          {canSeeToolkitPrivilegePreview ? (
            <section className="panel !mb-4 space-y-3 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base">Privilege Preview</h2>
                  <p className="small m-0 opacity-85">
                    Sysadmin-only toolkit access simulator. Hidden by default.
                  </p>
                </div>
                <button
                  type="button"
                  className={BTN_SM + " inline-flex items-center gap-2"}
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
                  viewer={user}
                  onViewerChange={async () => {
                    const res = await fetchAuthMe();
                    if (res.user) setUser(res.user);
                  }}
                  title="Toolkit Privileges"
                />
              ) : null}
            </section>
          ) : null}

          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {memberTools.map((tool) => (
              <article
                key={tool.key}
                className={`flex h-full flex-col gap-3 rounded-xl border border-white/12 bg-white/5 p-4 ${tool.key === "wreckingHelper" ? "hidden md:flex" : ""}`}
              >
                <img
                  src={
                    tool.key === "universe"
                      ? astrogationIcon
                      : tool.key === "wreckingHelper"
                        ? wreckerIcon
                      : tool.key === "changelog"
                        ? changelogIcon
                      : tool.key === "shipHeatmap"
                        ? combatCalcIcon
                      : tool.key === "weaponHeatmap"
                        ? heatmapIcon
                      : tool.key === "hyperplanner"
                        ? hyperIcon
                      : tool.key === "biometrics"
                        ? biometricsIcon
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
                      : tool.key === "rmBrowser"
                        ? rmIcon
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
                      : tool.key === "biometrics"
                        ? "Biometrics"
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
                      : tool.key === "rmBrowser"
                        ? "RM Browser"
                        : "JOE placeholder logo"
                  }
                  className={`h-[84px] w-[84px] object-contain ${(tool.key === "payments" && hasPendingPayments) || (tool.key === "jobs" && hasPendingClaims) ? "animate-members-alert-pulse" : ""}`}
                />
                <div className="grid gap-2">
                  <h2 className="m-0 text-base">{tool.title}</h2>
                  <p className="small m-0">{tool.description}</p>
                </div>
                <button
                  className={BTN + " mt-auto"}
                  type="button"
                  onClick={tool.onClick}
                >
                  {tool.actionLabel}
                </button>
              </article>
            ))}
          </section>
        </section>
      )}

      {membersView === "jobs" && (
        <>
          <div className="flex mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>

          <JobsSubnav activeView={jobsView} onChange={setJobsView} />

          {jobsView === "open" && (
            <OpenJobsPanel
              jobs={openJobs}
              onTake={onTake}
              onJoin={onJoin}
              initialJobId={requestedJobId > 0 ? requestedJobId : null}
              onInitialJobConsumed={() => {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("job_id");
                navigate({ pathname: "/tools", search: next.toString() ? `?${next}` : "" }, { replace: true });
              }}
            />
          )}

          {jobsView === "posted" && (
            <MyPostedJobsPanel
              jobs={myPostedJobs}
              onSetJobBonus={onSetJobBonus}
              onSetAssignmentBonus={onSetAssignmentBonus}
              onDeleteJob={onDeleteJob}
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

          {jobsView === "payClaims" && (
            <PayClaimsPanel isAdmin={!!(user?.is_admin || user?.is_sysadmin)} />
          )}
        </>
      )}

      {(membersView === "universe" || mountUniversePanel) && (
        <section style={{ display: membersView === "universe" ? "block" : "none" }}>
          <div className="flex items-center gap-3 mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
            <ReportBugButton toolKey="astrogation" toolLabel="Astrogation" />
          </div>
          {!mountUniversePanel ? (
            <section className="panel">
              <p className="small" style={{ margin: 0 }}>
                Opening Astrogation…
              </p>
            </section>
          ) : (
            <Suspense
              fallback={
                <section className="panel">
                  <p className="small" style={{ margin: 0 }}>
                    Opening Astrogation…
                  </p>
                </section>
              }
            >
              <MembersUniversePanel
                viewer={user}
                swcAuthFromParent={swcAuth}
                onSwcAuthChange={setSwcAuth}
                forcePublicTier={toolkitPrivPreviewOpen && toolkitPreviewPrivs.previewAsSubscriber}
              />
            </Suspense>
          )}
        </section>
      )}

      {membersView === "hyperplanner" && (
        <HyperPlannerPanel
          onBack={() => setMembersView("overview")}
          canRefreshStoredHyperlanes={canAccessSysadmin(user)}
        />
      )}

      {membersView === "biometrics" && (canSeeMemberOnlyTools || canSeeFleetCommander) && (
        <MemberFleetCommandPanel
          onBack={() => setMembersView("overview")}
          viewer={user}
          canSeeRoster={canSeeFleetCommander}
          swcAuth={swcAuth}
          onRequestSwcResync={handleResyncSwcAccess}
        />
      )}

      {membersView === "shipHeatmap" && canSeeCombatCalculator && (
        <>
          <div className="flex mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberCombatCalculatorPanel />
        </>
      )}

      {membersView === "weaponHeatmap" && (canSeeMemberOnlyTools || canSeePublicTools) && (
        <>
          <div className="flex mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberWeaponHeatmapPanel />
        </>
      )}

      {membersView === "stats" && (canSeeMemberOnlyTools || canSeePublicTools) && (
        <>
          <div className="flex mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <MemberEntityStatsPanel />
        </>
      )}

      {membersView === "archive" && canSeeGalacticArchive && (
        <MemberGalacticArchivePanel onBack={() => setMembersView("overview")} isAdmin={canAccessAdmin(user)} />
      )}

      {membersView === "wreckingHelper" && canSeeWreckingHelperExtension && !isMobile && (
        <MemberWreckingHelperPanel onBack={() => setMembersView("overview")} />
      )}

      {membersView === "rmBrowser" && canSeeRmBrowser && (
        <>
          <div className="flex mb-4">
            <button className={BTN} type="button" onClick={() => setMembersView("overview")}>
              Back to Overview
            </button>
          </div>
          <RmBrowserPanel />
        </>
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
