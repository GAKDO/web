import "@testing-library/jest-dom/vitest";
import { server } from "./shared/mocks/node";
import { resetDb } from "./shared/mocks/db";
import { tokenStore } from "./shared/auth/tokenStore";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  tokenStore.clear();
});
afterAll(() => server.close());
