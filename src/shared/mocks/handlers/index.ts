import { authHandlers } from "./auth";
import { deviceHandlers } from "./device";

export const handlers = [...authHandlers, ...deviceHandlers];
