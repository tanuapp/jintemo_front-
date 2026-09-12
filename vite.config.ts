import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: { preset: "node-server" },
  vite: {
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": {
          target: process.env["API_PROXY_TARGET"] || "http://127.0.0.1:5000",
          changeOrigin: false,
        },
        "/uploads": { target: process.env["API_PROXY_TARGET"] || "http://127.0.0.1:5000" },
        "/media": { target: process.env["API_PROXY_TARGET"] || "http://127.0.0.1:5000" },
      },
    },
  },
});
