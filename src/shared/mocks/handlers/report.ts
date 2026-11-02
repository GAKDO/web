import { http, HttpResponse } from "msw";
import type { ProgressStage } from "../../api/types";
import { accountFromRequest, db } from "../db";
import { problem } from "./problem";

// WE3 리포트 목: report-server 타임라인, 고객 화면이 읽는 기종 치수. 권한은 계약 x-trace-access(OWN_RENTAL)를 흉내 낸다

/** 렌탈을 볼 수 있는지. 관리자는 모두, 고객은 자기 렌탈만 */
export function rentalDenied(request: Request, rentalId: string | undefined) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (!rentalId || !db.rentals.some((r) => r.rentalId === rentalId)) return problem(404, "NOT_FOUND", "렌탈이 없습니다");
  if (account.role !== "ADMIN" && db.report.owners.get(rentalId) !== account.accountId) {
    return problem(403, "OUT_OF_SCOPE", "이 렌탈을 볼 권한이 없습니다");
  }
  return null;
}

/** 시점 ID → 렌탈 ID */
export function rentalOfCheckpoint(checkpointId: string): string | undefined {
  return db.rentals.find((r) => r.checkpoints.some((c) => c.checkpointId === checkpointId))?.rentalId;
}

const STAGES: [ProgressStage, number][] = [
  ["UPLOADED", 20],
  ["ALIGNED", 40],
  ["INSPECTED", 60],
  ["GRADED", 80],
];

/** 테스트용 스트림 끊기: true면 첫 이벤트 뒤 연결을 끊는다 */
export const streamControl = { dropAfterFirst: false };

/** 봉인 전 시점의 진행률을 차례로 보내고, 끝나면 봉인하고 done을 보낸다(계약 streamRentalProgress) */
function progressStream(rentalId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const step = import.meta.env.MODE === "test" ? 5 : 1500;
  const timeline = db.report.timelines.get(rentalId);
  const pending = timeline?.checkpoints.filter((c) => c.status !== "SEALED") ?? [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new ReadableStream({
    start(controller) {
      const events: (() => string)[] = [];
      for (const c of pending) {
        for (const [stage, percent] of STAGES) {
          events.push(() => `event: progress\ndata: ${JSON.stringify({ checkpointId: c.checkpointId, stage, percent, at: new Date().toISOString() })}\n\n`);
        }
        events.push(() => {
          c.status = "SEALED";
          c.grade = "A";
          c.sealedAt = new Date().toISOString();
          const rc = db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.find((x) => x.checkpointId === c.checkpointId);
          if (rc) rc.status = "SEALED";
          return `event: done\ndata: ${JSON.stringify({ checkpointId: c.checkpointId, grade: "A" })}\n\n`;
        });
      }
      let i = 0;
      const next = () => {
        if (i >= events.length) return; // 모두 보낸 뒤에는 keep-alive만 하는 셈으로 열어 둔다
        controller.enqueue(encoder.encode(events[i]()));
        i += 1;
        if (streamControl.dropAfterFirst && i === 1) {
          streamControl.dropAfterFirst = false;
          controller.close();
          return;
        }
        timer = setTimeout(next, step);
      };
      timer = setTimeout(next, step);
    },
    cancel() {
      clearTimeout(timer);
    },
  });
}

export const reportHandlers = [
  http.get("*/api/v1/reports/rentals/:rentalId/stream", ({ request, params }) => {
    const rentalId = String(params.rentalId);
    const no = rentalDenied(request, rentalId);
    if (no) return no;
    return new HttpResponse(progressStream(rentalId), { headers: { "Content-Type": "text/event-stream" } });
  }),

  http.get("*/api/v1/reports/rentals/:rentalId", ({ request, params }) => {
    const rentalId = String(params.rentalId);
    const no = rentalDenied(request, rentalId);
    if (no) return no;
    const timeline = db.report.timelines.get(rentalId);
    return timeline ? HttpResponse.json(timeline) : problem(404, "NOT_FOUND", "리포트가 없습니다");
  }),

  http.get("*/api/v1/device-models/:modelCode", ({ request, params }) => {
    if (!accountFromRequest(request)) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    const model = db.models.find((m) => m.modelCode === params.modelCode);
    return model ? HttpResponse.json(model) : problem(404, "NOT_FOUND", "기종이 없습니다");
  }),
];
