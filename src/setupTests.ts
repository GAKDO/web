import "@testing-library/jest-dom/vitest";
import { server } from "./shared/mocks/node";
import { resetDb } from "./shared/mocks/db";
import { resetCaptureDb } from "./shared/mocks/captureDb";
import { captureTokenStore } from "./shared/auth/captureTokenStore";
import { tokenStore } from "./shared/auth/tokenStore";

// jsdom에는 revokeObjectURL이 없다(촬영 미리보기 해제용)
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  resetCaptureDb();
  captureTokenStore.clear();
  tokenStore.clear();
});
afterAll(() => server.close());
