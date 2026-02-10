// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// global styles
import "./styles/theme.sass";   // <– your big CSS file converted to SASS
import "./styles/main.sass";    // if you already had this

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
