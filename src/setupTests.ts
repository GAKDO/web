// 테스트 도구(테스트 자체는 아님): 모든 화면 시험이 시작하기 전에 한 번 도는 준비 파일.
// 가짜 서버(MSW)를 켜서 진짜 서버 대신 미리 정한 응답을 주고, 시험마다 가짜 데이터·로그인 토큰을 처음 상태로 되돌린다.
// 가짜 서버에 정해 두지 않은 요청이 나가면 시험이 실패한다(빠뜨린 API 호출을 잡으려고).

import "@testing-library/jest-dom/vitest";
import { server } from "./shared/mocks/node";
import { resetDb } from "./shared/mocks/db";
import { resetCaptureDb } from "./shared/mocks/captureDb";
import { captureTokenStore } from "./shared/auth/captureTokenStore";
import { tokenStore } from "./shared/auth/tokenStore";

// jsdom에는 revokeObjectURL이 없다(촬영 미리보기 해제용)
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
// jsdom에는 화면 스크롤이 없다. 화면을 옮길 때 맨 위로·#앵커로 내리는 ScrollRestoration(App.tsx)이 부른다. 테스트는 vi.spyOn으로 호출을 본다
window.scrollTo = (() => undefined) as typeof window.scrollTo;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  resetCaptureDb();
  captureTokenStore.clear();
  tokenStore.clear();
});
afterAll(() => server.close());
