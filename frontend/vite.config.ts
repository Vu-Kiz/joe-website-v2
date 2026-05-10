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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (
              id.includes("/@deck.gl/core/") ||
              id.includes("/@luma.gl/core/") ||
              id.includes("/@luma.gl/engine/") ||
              id.includes("/@math.gl/")
            ) {
              return "deck-core";
            }

            if (id.includes("/@deck.gl/layers/") || id.includes("/@deck.gl/extensions/")) {
              return "deck-layers";
            }

            if (id.includes("/deck.gl/") || id.includes("/@deck.gl/react/")) {
              return "deck-react";
            }

            return undefined;
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: "http://backend",
          changeOrigin: true,
          secure: false,
        },
        "/sanctum": {
          target: "http://backend",
          changeOrigin: true,
          secure: false,
        },
        "/share": {
          target: "http://backend",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    hmr: {
      protocol: "wss",
      host: "dev-v2.swc-joe.com",
      clientPort: 443,
    },
  };
  
});
