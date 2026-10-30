/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API는 gateway(NodePort 8314)로 보낸다. 개발 중에는 VITE_API_BASE를 비우고 이 프록시를 쓴다
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.VITE_DEV_API ?? "http://localhost:8080" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
