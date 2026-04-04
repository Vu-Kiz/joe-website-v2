import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../../api/auth";
import {
  getDroidBrain,
  uploadDroidBrainFile,
  type DroidBrainContext,
  type DroidBrainTab,
  type DroidBrainUploadResult,
} from "../../api/droidbrain";
import {
  canAccessDroidBrain,
  canAccessDroidBrainFull,
  canAccessSysadmin,
} from "../../auth/permissions";
import ForbiddenState from "../common/ForbiddenState";
import NotLoggedInState from "../common/NotLoggedInState";
import SpinnerLoadingCard from "../common/SpinnerLoadingCard";
import DroidBrainFiltersPanel from "../droidbrain/DroidBrainFiltersPanel";
import DroidBrainResultsPanel from "../droidbrain/DroidBrainResultsPanel";
import DroidBrainSummaryPanel from "../droidbrain/DroidBrainSummaryPanel";
import DroidBrainTabs from "../droidbrain/DroidBrainTabs";
import DroidBrainUploadPanel from "../droidbrain/DroidBrainUploadPanel";
import "../../styles/main.sass";
import "../../styles/_admin.sass";
import "../../styles/_membersuniverse.sass";

const MAX_DROIDBRAIN_UPLOAD_FILES = 10;

const defaultTabLabels: Record<DroidBrainTab, string> = {
  ships: "Ships",
  stations: "Stations",
  planets: "Planets",
  cities: "Cities",
  vehicles: "Vehicles",
  npcs: "NPCs",
  summary: "Summary",
};

const restrictedTabLabels: Record<DroidBrainTab, string> = {
  ships: "Ships",
  stations: "Stations",
  vehicles: "Vehicles",
} as Record<DroidBrainTab, string>;

const emptyContext = (tab: DroidBrainTab): DroidBrainContext => ({
  tab,
  tab_labels: defaultTabLabels,
  filters: {
    q: "",
    uid: "",
    uploader: "",
    type: "",
    class: "",
    system: "",
    planet: "",
    owner: "",
  },
  options: {
    uploader_options: [],
    type_options: [],
    class_options: [],
    system_options: [],
    planet_options: [],
    owner_options: [],
  },
  did_search: false,
  results: [],
  total_rows: 0,
  page: 1,
  per_page: 50,
  total_pages: 1,
  summary: {},
});

const normalizeTab = (value: string | null): DroidBrainTab => {
  switch (value) {
    case "ships":
    case "stations":
    case "planets":
    case "cities":
    case "vehicles":
    case "npcs":
    case "summary":
      return value;
    default:
      return "ships";
  }
};

const MemberDroidBrainPanel: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [context, setContext] = useState<DroidBrainContext | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<DroidBrainUploadResult[]>([]);

  const activeTab = normalizeTab(searchParams.get("tab"));
  const requestParams = useMemo(() => {
    const params = Object.fromEntries(searchParams.entries());
    params.tab = activeTab;
    return params;
  }, [activeTab, searchParams]);
  const requestKey = useMemo(
    () => new URLSearchParams(requestParams).toString(),
    [requestParams]
  );
  const shouldLoadCurrent = true;

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
        const auth = await fetchAuthMe();
        const currentUser = auth?.user ?? null;

        if (cancelled) return;

        setViewer(currentUser);

        if (!currentUser) {
          setContext(null);
          setError(null);
          return;
        }

        if (!canAccessDroidBrain(currentUser)) {
          setContext(null);
          setError(null);
          return;
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load DroidBrain.");
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

  useEffect(() => {
    if (!viewer || !canAccessDroidBrain(viewer) || !shouldLoadCurrent) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingKey(requestKey);
        const response = await getDroidBrain(requestParams);

        if (cancelled) return;

        setContext(response.data);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load DroidBrain.");
      } finally {
        if (!cancelled) {
          setLoadingKey((current) => (current === requestKey ? null : current));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey, requestParams, shouldLoadCurrent, viewer]);

  const filters = context?.filters ?? emptyContext(activeTab).filters;
  const effectiveTab = context?.tab ?? activeTab;
  const isTabLoading = loadingKey === requestKey && context == null;
  const isRefreshingResults = loadingKey === requestKey && context != null;
  const isRestrictedView = !canAccessDroidBrainFull(viewer);
  const tabLabels =
    context?.tab_labels ?? (isRestrictedView ? restrictedTabLabels : defaultTabLabels);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    if (!patch.page) {
      next.delete("page");
    }

    setSearchParams(next);
  };

  const applyFilters = (nextFilters: DroidBrainContext["filters"]) => {
    updateParams({
      q: nextFilters.q,
      uid: nextFilters.uid,
      uploader: nextFilters.uploader,
      type: nextFilters.type,
      class: nextFilters.class,
      system: nextFilters.system,
      planet: nextFilters.planet,
      owner: nextFilters.owner,
      page: null,
    });
  };

  const resetFilters = () => {
    updateParams({
      q: null,
      uid: null,
      uploader: null,
      type: null,
      class: null,
      system: null,
      planet: null,
      owner: null,
      page: null,
    });
  };

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>DroidBrain</h1>
            <div className="panel admin-panel">
              <div className="admin-panel__body">
                <SpinnerLoadingCard
                  compact
                  title="Loading DroidBrain Intel"
                  tip="Analysts are sorting scout reports, indexing old sightings, and rebuilding the latest known picture."
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access DroidBrain."
            />
          </main>
        </div>
      </div>
    );
  }

  if (!canAccessDroidBrain(viewer)) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <ForbiddenState
              title="403 Forbidden"
              message="You do not have permission to access DroidBrain."
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
          <h1>DroidBrain</h1>
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => navigate("/members")}>
              Back to Overview
            </button>
          </div>
          <p className="small">
            Internal intel browser for imported DroidBrain data. This first pass brings the browse layer online so legacy import and mobile `.rss` uploads can attach to the same database next.
          </p>

          {error && (
            <div className="panel">
              <p className="small" style={{ color: "salmon" }}>{error}</p>
            </div>
          )}

          <DroidBrainUploadPanel
            uploading={uploading}
            uploadStatus={uploadStatus}
            uploadResults={uploadResults}
            isSysadmin={canAccessSysadmin(viewer)}
            onUpload={async (files) => {
              try {
                setUploading(true);
                setUploadStatus(null);
                setUploadResults([]);
                const batch = files.slice(0, MAX_DROIDBRAIN_UPLOAD_FILES);
                const results: DroidBrainUploadResult[] = [];

                for (let index = 0; index < batch.length; index += 1) {
                  const file = batch[index];
                  setUploadStatus(`Uploading file ${index + 1} of ${batch.length}: ${file.name}`);
                  const response = await uploadDroidBrainFile(file);
                  results.push(response.data);
                  setUploadResults([...results]);
                }

                setError(null);
                setUploadStatus(`Refreshing DroidBrain results after ${batch.length} upload${batch.length === 1 ? "" : "s"}…`);

                if (requestKey) {
                  setLoadingKey(requestKey);
                }

                const refreshed = await getDroidBrain(requestParams);
                setContext(refreshed.data);
              } catch (e: any) {
                setError(e?.message ?? "Failed to upload DroidBrain file.");
              } finally {
                setUploading(false);
                setUploadStatus(null);
                setLoadingKey(null);
              }
            }}
          />

          <DroidBrainTabs
            activeTab={effectiveTab}
            tabLabels={tabLabels}
            onSelect={(tab) => {
              if (tab === effectiveTab) {
                return;
              }

              updateParams({ tab, page: null });
            }}
          />

          <DroidBrainFiltersPanel
            activeTab={effectiveTab}
            filters={filters}
            isRestrictedView={isRestrictedView}
            options={context?.options ?? emptyContext(effectiveTab).options}
            onSubmit={applyFilters}
            onReset={resetFilters}
          />

          {isTabLoading && (
            <div className="panel admin-panel">
              <div className="admin-panel__body">
                <SpinnerLoadingCard
                  compact
                  title="Loading DroidBrain Intel"
                  tip="Filtering sightings, syncing entity records, and reconstructing the latest intel snapshot."
                />
              </div>
            </div>
          )}

          {isRefreshingResults && (
            <div className="panel admin-panel">
              <div className="admin-panel__body">
                <SpinnerLoadingCard
                  compact
                  title="Refreshing DroidBrain Results"
                  tip="Updating the current tab with the latest imported records, filters, and page data."
                />
              </div>
            </div>
          )}

          {context && effectiveTab === "summary" && (
            <DroidBrainSummaryPanel summary={context.summary} tabLabels={tabLabels} />
          )}

          {context && effectiveTab !== "summary" && (
            <DroidBrainResultsPanel
              context={context}
              isRestrictedView={isRestrictedView}
              onPageChange={(page) => updateParams({ page: String(page) })}
              onPageSizeChange={(pageSize) =>
                updateParams({ per_page: String(pageSize), page: null })
              }
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default MemberDroidBrainPanel;
