import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const allowedHosts =
    env.VITE_ALLOWED_HOSTS?.split(",").map(h => h.trim()) || [];

  return {
    plugins: [react()],
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
