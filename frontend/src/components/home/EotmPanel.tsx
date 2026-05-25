import React, { useEffect, useMemo, useState } from "react";
import employeeBanner from "../../assets/home/EmployeeBanner.png";
import { getCurrentEotm, type EotmEntry } from "../../api/content/eotm";
import { getBackendOrigin } from "../../api/core/auth";
import BBCodeView from "../bbcode/BBCodeView";

const EOTM_PANEL_CLS = "flex items-start gap-4 mt-3";
const EOTM_LEFT_CLS = "flex flex-col items-center shrink-0 w-[180px]";
const EOTM_IMAGE_CLS = "w-full max-w-[100px] block mx-auto rounded-[12px] object-cover";
const EOTM_NAME_CLS = "m-0 mt-[0.6rem] text-center font-['Tektur',sans-serif] font-normal text-[var(--jen-orange)]";

const resolveImageUrl = (imageUrl: string | null): string | null => {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const origin = getBackendOrigin();
  return origin ? `${origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}` : imageUrl;
};

const EotmPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<EotmEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await getCurrentEotm();
        if (cancelled) return;

        setEntry(res.entry ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load Employee of the Month");
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

  const imageSrc = useMemo(() => resolveImageUrl(entry?.image_url ?? null), [entry]);

  return (
    <section className="panel">
      <div className="panel-banner">
        <img src={employeeBanner} alt="Employee of the Month" />
      </div>

      {loading && (
        <p className="copy">Pulling current Employee of the Month from the Jawa archives…</p>
      )}

      {!loading && error && (
        <p className="copy">{error}</p>
      )}

      {!loading && !error && !entry && (
        <p className="copy">No Employee of the Month has been recorded yet.</p>
      )}

      {!loading && !error && entry && (
        <div className={EOTM_PANEL_CLS}>
          <div className={EOTM_LEFT_CLS}>
            {imageSrc && (
              <div className="w-full">
                <img src={imageSrc} alt={entry.name} className={EOTM_IMAGE_CLS} />
              </div>
            )}
            <h3 className={EOTM_NAME_CLS}>{entry.name}</h3>
          </div>

          <div className="flex-1 min-w-0">
            <BBCodeView value={entry.reason} className="m-0" />
          </div>
        </div>
      )}
    </section>
  );
};

export default EotmPanel;
