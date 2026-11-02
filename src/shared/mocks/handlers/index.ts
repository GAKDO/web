import { authHandlers } from "./auth";
import { captureHandlers } from "./capture";
import { captureReportHandlers } from "./capture-report";
import { deviceHandlers } from "./device";
import { diagnosticsHandlers } from "./diagnostics";
import { rentalHandlers } from "./rental";
import { reportHandlers } from "./report";
import { verifyHandlers } from "./verify";

export const handlers = [
  ...authHandlers,
  ...deviceHandlers,
  ...rentalHandlers,
  ...verifyHandlers,
  ...captureHandlers,
  ...reportHandlers,
  ...captureReportHandlers,
  ...diagnosticsHandlers,
];
