// frontend/src/main.tsx (example)
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tailwind.css";
import { getApiBaseUrl, initCsrf } from "./api/core/auth";

const Root: React.FC = () => {
  useEffect(() => {
    const isDevEnv = (() => {
      const viteEnv = String((import.meta as any).env?.VITE_APP_ENV ?? "").trim().toLowerCase();
      if (viteEnv === "dev" || viteEnv === "development" || viteEnv === "local") {
        return true;
      }

      const apiBase = getApiBaseUrl().toLowerCase();
      if (apiBase.includes("dev")) {
        return true;
      }

      const hostname = window.location.hostname.toLowerCase();
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("dev-");
    })();

    document.title = isDevEnv ? "JOE (DEV)" : "JOE";

    // fire and forget; if it fails, apiFetch will still try requests,
    // but CSRF will be missing and you’ll see 419 (which is fine for now)
    initCsrf().catch(() => {
      // optionally log
      console.warn("Failed to init CSRF cookie");
    });
  }, []);

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
