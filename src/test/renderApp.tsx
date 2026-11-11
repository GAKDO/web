import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders, createQueryClient } from "../AppProviders";
import { routes, withRoot } from "../App";
import { db } from "../shared/mocks/db";

/** 실제 라우트·Provider로 한 주소를 연다. 테스트마다 새 QueryClient */
export function renderApp(path: string) {
  const router = createMemoryRouter(withRoot(routes), { initialEntries: [path] });
  const client = createQueryClient();
  const view = render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, client };
}

/** 관리자로 로그인된 상태(리프레시 쿠키가 있는 상태)에서 한 주소를 연다 */
export function renderAsAdmin(path: string) {
  db.refreshAccount = db.accounts.find((a) => a.role === "ADMIN") ?? null;
  return renderApp(path);
}

/** 고객으로 로그인된 상태에서 한 주소를 연다(WE3) */
export function renderAsCustomer(path: string) {
  db.refreshAccount = db.accounts.find((a) => a.role === "CUSTOMER") ?? null;
  return renderApp(path);
}
