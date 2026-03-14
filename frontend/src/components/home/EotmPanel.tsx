import React, { useEffect, useMemo, useState } from "react";
import employeeBanner from "../../assets/home/EmployeeBanner.png";
import { getCurrentEotm, type EotmEntry } from "../../api/eotm";
import { getBackendOrigin } from "../../api/auth";
import BBCodeView from "../bbcode/BBCodeView";
import styles from "../../styles/home.module.sass";

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
        <div className={styles.small}>
          <p>Pulling current Employee of the Month from the Jawa archives…</p>
        </div>
      )}

      {!loading && error && (
        <div className={styles.small}>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && !entry && (
        <div className={styles.small}>
          <p>No Employee of the Month has been recorded yet.</p>
        </div>
      )}

      {!loading && !error && entry && (
        <div className={styles.eotmPanel}>
          <div className={styles.eotmLeft}>
            {imageSrc && (
              <div className={styles.eotmImageWrap}>
                <img src={imageSrc} alt={entry.name} className={styles.eotmImage} />
              </div>
            )}

            <h3 className={styles.eotmName}>{entry.name}</h3>
          </div>

          <div className={styles.eotmRight}>
            <div className={styles.small}>
              <BBCodeView value={entry.reason} className={styles.eotmReason} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default EotmPanel;