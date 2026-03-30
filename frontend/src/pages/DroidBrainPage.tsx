import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import {
  createDroidBrainRewardPayment,
  getDroidBrain,
  getDroidBrainUploadDebug,
  uploadDroidBrainFile,
  type DroidBrainContext,
  type DroidBrainTab,
  type DroidBrainUploadDebug,
  type DroidBrainUploadResult,
} from "../api/droidbrain";
import { canAccessIntel, canAccessSysadmin } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import SpinnerLoadingCard from "../components/common/SpinnerLoadingCard";
import DroidBrainFiltersPanel from "../components/droidbrain/DroidBrainFiltersPanel";
import DroidBrainResultsPanel from "../components/droidbrain/DroidBrainResultsPanel";
import DroidBrainSummaryPanel from "../components/droidbrain/DroidBrainSummaryPanel";
import DroidBrainTabs from "../components/droidbrain/DroidBrainTabs";
import DroidBrainUploadPanel from "../components/droidbrain/DroidBrainUploadPanel";
import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";

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

const emptyContext = (tab: DroidBrainTab): DroidBrainContext => ({
  tab,
  tab_labels: defaultTabLabels,
  filters: {
    q: "",
    uid: "",
    type: "",
    class: "",
    system: "",
    planet: "",
    owner: "",
  },
  options: {
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

const DroidBrainPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [context, setContext] = useState<DroidBrainContext | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<DroidBrainUploadResult[]>([]);
  const [uploadDebug, setUploadDebug] = useState<DroidBrainUploadDebug | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [creatingRewardPayment, setCreatingRewardPayment] = useState(false);

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

        if (!canAccessIntel(currentUser)) {
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
    if (!viewer || !canAccessIntel(viewer) || !shouldLoadCurrent) {
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
  const isTabLoading = loadingKey === requestKey && context == null;
  const tabLabels = context?.tab_labels ?? defaultTabLabels;

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

  if (!canAccessIntel(viewer)) {
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
            uploadResults={uploadResults}
            uploadDebug={uploadDebug}
            loadingDebug={loadingDebug}
            creatingRewardPayment={creatingRewardPayment}
            isSysadmin={canAccessSysadmin(viewer)}
            onUpload={async (files) => {
              try {
                setUploading(true);
                setUploadDebug(null);
                setUploadResults([]);
                const batch = files.slice(0, MAX_DROIDBRAIN_UPLOAD_FILES);
                const results: DroidBrainUploadResult[] = [];

                for (const file of batch) {
                  const response = await uploadDroidBrainFile(file);
                  results.push(response.data);
                  setUploadResults([...results]);
                }

                setError(null);

                if (requestKey) {
                  setLoadingKey(requestKey);
                }

                const refreshed = await getDroidBrain(requestParams);
                setContext(refreshed.data);
              } catch (e: any) {
                setError(e?.message ?? "Failed to upload DroidBrain file.");
              } finally {
                setUploading(false);
                setLoadingKey(null);
              }
            }}
            onLoadDebug={async (fileId) => {
              try {
                setLoadingDebug(true);
                const response = await getDroidBrainUploadDebug(fileId);
                setUploadDebug(response.data);
                setError(null);
              } catch (e: any) {
                setError(e?.message ?? "Failed to load upload debug.");
              } finally {
                setLoadingDebug(false);
              }
            }}
            onCreateRewardPayment={async (fileId, payerFactionId) => {
              try {
                setCreatingRewardPayment(true);
                const response = await createDroidBrainRewardPayment(fileId, payerFactionId);
                setUploadResults((current) =>
                  current.map((item) =>
                    item.file_id === fileId ? { ...item, reward_summary: response.data } : item
                  )
                );
                const refreshed = await getDroidBrainUploadDebug(fileId);
                setUploadDebug(refreshed.data);
                setError(null);
              } catch (e: any) {
                setError(e?.message ?? "Failed to create DroidBrain payment item.");
              } finally {
                setCreatingRewardPayment(false);
              }
            }}
          />

          <DroidBrainTabs
            activeTab={activeTab}
            tabLabels={tabLabels}
            onSelect={(tab) => {
              if (tab === activeTab) {
                return;
              }

              updateParams({ tab, page: null });
            }}
          />

          <DroidBrainFiltersPanel
            activeTab={activeTab}
            filters={filters}
            options={context?.options ?? emptyContext(activeTab).options}
            onChange={(patch) => updateParams(patch)}
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

          {context && activeTab === "summary" && (
            <DroidBrainSummaryPanel summary={context.summary} tabLabels={tabLabels} />
          )}

          {context && activeTab !== "summary" && (
            <DroidBrainResultsPanel
              context={context}
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

export default DroidBrainPage;
