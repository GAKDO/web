import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "./AppProviders";
import { routes } from "./App";
// 글꼴은 서버에 같이 넣는다(외부 CDN 없이): 한글·영문 모두 Pretendard(필요한 글자 묶음만 받음, 11/8)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./index.css";

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
