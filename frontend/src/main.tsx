// frontend/src/main.tsx (example)
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initCsrf } from "./api/auth";

const Root: React.FC = () => {
  useEffect(() => {
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