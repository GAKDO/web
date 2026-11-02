import { authHandlers } from "./auth";
import { deviceHandlers } from "./device";
import { rentalHandlers } from "./rental";
import { verifyHandlers } from "./verify";

export const handlers = [...authHandlers, ...deviceHandlers, ...rentalHandlers, ...verifyHandlers];
