import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/SPACE_PLOT/",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "dev-html-serve",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next();
          if (req.url.startsWith("/SPACE_PLOT")) {
            req.url = req.url.replace(/^\/SPACE_PLOT\/?/, "/") || "/";
          }
          if (req.url === "/" || req.url === "/index.html") {
            req.url = "/app.html";
          }
          next();
        });
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL("./app.html", import.meta.url)),
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/three/")) return "three-vendor";
          if (id.includes("/@supabase/")) return "cloud-vendor";
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react-vendor";
          if (
            /\/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(
              id,
            )
          )
            return "motion-vendor";
        },
      },
    },
  },
}));
