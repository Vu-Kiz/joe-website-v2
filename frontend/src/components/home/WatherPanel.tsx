import React, { useEffect, useState } from "react";
import weatherBanner from "../../assets/home/WeatherBanner.png";
import twinSuns from "../../assets/home/twin-suns.png";
import { getTatooineWeather } from "../../api/weather";
import styles from "../../styles/home.module.sass";

const WeatherPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Initialising Mos Espa Weather Control network…");
  const [temp, setTemp] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getTatooineWeather();
        if (cancelled) return;

        setMessage(res.weather.message);
        setTemp(res.weather.temperature);
      } catch {
        if (!cancelled) {
          setMessage("Mos Espa Weather Control is temporarily unavailable.");
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

  return (
    <section className="panel">
      <div className="panel-banner">
        <img src={weatherBanner} alt="Mos Espa Weather Control" />
      </div>

      <div className={styles.weatherPanelTop}>
        <img src={twinSuns} alt="Twin Suns" className={styles.twinSunsIcon} />

        <div className={styles.weatherTempWrap}>
          <div className={styles.weatherTemp}>
            {temp != null ? `${temp}°` : "—°"}
          </div>
        </div>
      </div>

      <p className={styles.small} style={{ marginTop: 10 }}>
        {loading ? "Initialising Mos Espa Weather Control network…" : message}
      </p>
    </section>
  );
};

export default WeatherPanel;