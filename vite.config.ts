/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// API는 gateway(NodePort 8314)로 보낸다. 개발 중에는 VITE_API_BASE를 비우고 이 프록시를 쓴다
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // shadcn/ui 부품이 쓰는 "@/..." 경로(components.json과 같음)
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": process.env.VITE_DEV_API ?? "http://localhost:8080",
      // 진단 에이전트 설치 스크립트(nginx.conf의 /agent.sh·/agent.ps1과 같은 GitHub 원본)
      "/agent.sh": { target: "https://raw.githubusercontent.com", changeOrigin: true, rewrite: () => "/GAKDO/agent/v0.2.0/install/agent.sh" },
      "/agent.ps1": { target: "https://raw.githubusercontent.com", changeOrigin: true, rewrite: () => "/GAKDO/agent/v0.2.0/install/agent.ps1" },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
