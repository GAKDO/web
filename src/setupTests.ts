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
