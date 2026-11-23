// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { ConfigEnv } from "vite";

const lovableConfig = defineConfig({
  // Make the dev server reachable from localhost and other devices on the LAN.
  vite: {
    server: {
      host: true,
    },
    // Load .env from the project root for both localhost and LAN access.
    envDir: ".",
    resolve: {
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
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

export default async (env: ConfigEnv) => {
  const config = await lovableConfig(env);
  config.plugins = config.plugins?.filter((plugin) => {
    if (!plugin || Array.isArray(plugin) || typeof plugin !== "object") return true;
    return !("name" in plugin) || plugin.name !== "vite-tsconfig-paths";
  });
  return config;
};
