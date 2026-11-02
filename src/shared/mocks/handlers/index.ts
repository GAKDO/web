import { authHandlers } from "./auth";
import { deviceHandlers } from "./device";
import { rentalHandlers } from "./rental";

export const handlers = [...authHandlers, ...deviceHandlers, ...rentalHandlers];
