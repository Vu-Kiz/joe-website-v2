import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as { version?: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const allowedHosts =
    env.VITE_ALLOWED_HOSTS?.split(",").map(h => h.trim()) || [];

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts,
    },
    hmr: {
      protocol: "wss",
      host: "dev-v2.swc-joe.com",
      clientPort: 443,
    },
  };
  
});
