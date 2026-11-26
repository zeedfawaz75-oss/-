import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const define: Record<string, string> = {};
  if (env.SUPABASE_URL) {
    define["import.meta.env.SUPABASE_URL"] = JSON.stringify(env.SUPABASE_URL);
  }
  if (env.SUPABASE_PUBLISHABLE_KEY) {
    define["import.meta.env.SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(
      env.SUPABASE_PUBLISHABLE_KEY,
    );
  }

  return {
    define,
    plugins: [
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build"
        ? [
            nitro({
              preset: "cloudflare-module",
              cloudflare: { nodeCompat: true, deployConfig: true },
            }),
          ]
        : []),
      react(),
    ],
    server: {
      host: true,
    },
    envDir: ".",
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-start", "@tanstack/react-router"],
      tsconfigPaths: true,
    },
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              manualChunks(id) {
                const moduleId = id.replace(/\\/g, "/");
                if (moduleId.includes("/node_modules/react-dom/")) return "react-dom";
              },
            },
          },
        },
      },
    },
  };
});
