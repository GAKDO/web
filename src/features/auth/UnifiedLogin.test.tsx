// 이 파일이 확인하는 것: 관리자와 고객이 함께 쓰는 하나의 로그인 화면(/login).
// 넣은 계정이 관리자면 관리 화면으로, 고객이면 내 계정 화면으로 보낸다.
// 고객 계정 기능을 숨긴 MVP 배포에서는 예전처럼 관리자만 로그인한다.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, renderAsCustomer } from "../../test/renderApp";
import { nanoid } from "nanoid";
import { db, MOCK_ADMIN, MOCK_CUSTOMER } from "../../shared/mocks/db";
import { REPORT } from "../report/api/report";
import { tokenStore } from "../../shared/auth/tokenStore";

afterEach(() => vi.unstubAllEnvs());

// 테스트 도구: 고객 계정 기능은 켜고, 폰 촬영·진단·리포트·파일럿만 보관(숨김)한 배포 설정.
const ACCOUNT_ON = "phoneCapture,diagnostics,report,pilot";

// 테스트 도구: 로그인 화면에 이메일·비밀번호를 넣고 "로그인"을 누른다.
async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.type(screen.getByLabelText("비밀번호"), password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
}

// [상황] 고객 계정을 보이는 배포에서 예전 관리자 로그인 주소를 열고 관리자 계정을 넣는다.
// [기대] 공용 로그인 화면(/login)으로 옮겨지고, 로그인하면 관리 화면(기기 목록)으로 간다.
test("고객 계정을 보이는 배포에서 관리자 로그인 주소를 열면 공용 로그인으로 가고, 관리자 계정을 넣으면 관리자 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const { router } = renderApp("/admin/login");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  await signIn(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("link", { name: "기기" });
  expect(router.state.location.pathname).toBe("/admin/devices");
});

// [상황] 같은 로그인 화면에 고객 계정을 넣는다.
// [기대] 관리 화면이 아니라 고객의 내 계정 화면으로 간다.
test("같은 로그인 화면에 고객 계정을 넣으면 내 계정 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const { router } = renderApp("/admin/login");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  await signIn(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByRole("heading", { name: "내 정보" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/my/account");
});

// [상황] 고객 계정 기능을 숨긴 MVP 배포에서 관리자 로그인 화면을 연다.
// [기대] 관리자 로그인 화면 그대로이고, 고객 계정을 넣으면 들어가지 못한다.
test("고객 계정을 숨긴 MVP 배포에서는 관리자 로그인 그대로이고 고객 계정은 들어가지 못한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,account,pilot");
  const { router } = renderApp("/admin/login");
  expect(await screen.findByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
  await signIn(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByRole("status")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/login");
});

// [상황] 고객 A로 렌탈 목록을 본 탭에서 로그아웃 없이 고객 B로 로그인한다.
// [기대] A의 렌탈 목록(화면에 저장해 둔 값)이 B에게 보이지 않는다. 남의 렌탈이 새지 않게 하는 확인이다.
test("고객 A 세션이 남은 탭에서 고객 B로 로그인하면 A의 렌탈 캐시가 B에게 남지 않는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const other = { email: "renter-b@example.com", password: "example-pass-5678" };
  db.accounts.push({ accountId: nanoid(), ...other, role: "CUSTOMER" });
  const { client } = renderAsCustomer("/admin/login");
  await waitFor(() => expect(tokenStore.get()?.role).toBe("CUSTOMER"));
  const key = [...REPORT, "rentals"];
  client.setQueryData(key, ["고객 A의 렌탈"]);
  await signIn(other.email, other.password);
  expect(await screen.findByRole("heading", { name: "내 정보" })).toBeInTheDocument();
  expect(client.getQueryData(key)).toBeUndefined();
});

// [상황] 관리자가 관리 화면에서 로그아웃한다.
// [기대] 관리자 로그인 화면이 아니라 사이트 첫 화면(/)으로 간다.
test("관리자가 관리 화면에서 로그아웃하면 관리자 로그인이 아니라 첫 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const { router } = renderApp("/login");
  await signIn(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("link", { name: "기기" });
  await userEvent.setup().click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  await waitFor(() => expect(tokenStore.get()).toBeNull());
});
