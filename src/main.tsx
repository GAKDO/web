import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "./AppProviders";
import { routes } from "./App";
import "./styles.css";

async function start() {
  // 서버(AU1·RE1)가 뜨기 전에는 VITE_USE_MOCK=true로 목 서버를 켠다
  if (import.meta.env.VITE_USE_MOCK === "true") {
    const { worker } = await import("./shared/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={createBrowserRouter(routes)} />
      </AppProviders>
    </StrictMode>,
  );
}

void start();
