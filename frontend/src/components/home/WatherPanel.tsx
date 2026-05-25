import React, { useEffect, useState } from "react";
import weatherBanner from "../../assets/home/WeatherBanner.png";
import twinSuns from "../../assets/home/WeatherLogo.png";
import { getTatooineWeather } from "../../api/content/weather";

const TWIN_SUNS_CLS = "block w-[95px] h-auto drop-shadow-[0_0_8px_rgba(246,163,0,0.4)] hover:drop-shadow-[0_0_12px_rgba(246,163,0,0.7)] transition-[filter] duration-[400ms]";
const WEATHER_TEMP_CLS = "font-['Bitcount_Grid_Single',monospace] text-[4rem] font-semibold text-[var(--jen-orange)] leading-none drop-shadow-[0_0_8px_rgba(246,163,0,0.4)]";

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

      <div className="flex items-center justify-center gap-6 mt-3">
        <img src={twinSuns} alt="Twin Suns" className={TWIN_SUNS_CLS} />
        <div className="flex items-center">
          <div className={WEATHER_TEMP_CLS}>
            {temp != null ? `${temp}°` : "—°"}
          </div>
        </div>
      </div>

      <p className="small mt-2.5">
        {loading ? "Initialising Mos Espa Weather Control network…" : message}
      </p>
    </section>
  );
};

export default WeatherPanel;
