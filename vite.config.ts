import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    ...(command === "build"
      ? [nitro({ preset: "cloudflare-module", cloudflare: { nodeCompat: true, deployConfig: true } })]
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
}));
