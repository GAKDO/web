import "@testing-library/jest-dom/vitest";
import { server } from "./shared/mocks/node";
import { resetDb } from "./shared/mocks/db";
import { resetCaptureDb } from "./shared/mocks/captureDb";
import { captureTokenStore } from "./shared/auth/captureTokenStore";
import { tokenStore } from "./shared/auth/tokenStore";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  resetCaptureDb();
  captureTokenStore.clear();
  tokenStore.clear();
});
afterAll(() => server.close());
