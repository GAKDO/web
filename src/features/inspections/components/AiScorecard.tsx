import type { DefectReviewQueueItem } from "../../../shared/api/types";
import { useCountUp } from "../../../shared/motion/useCountUp";
import { useReviewQueue } from "../api/reviews";

/** 성적표에 넣는 최근 검수 완료 시점 수(API 상한 100) */
export const SCORECARD_LIMIT = 100;

export interface Score {
  checkpoints: number;
  confirmed: number;
  dismissed: number;
  /** 사람이 흠집이라고 확정한 비율(%). 판정한 후보가 없으면 null */
  precision: number | null;
  /** 모델 버전별(후보가 있었던 시점만) */
  byModel: { modelVersion: string; confirmed: number; dismissed: number }[];
}

/** 검수 완료 시점들의 확정·기각 후보 수를 더한다. AI 후보가 없던 시점은 시점 수에만 센다 */
export function scoreOf(items: DefectReviewQueueItem[]): Score {
  let confirmed = 0;
  let dismissed = 0;
  const models = new Map<string, { confirmed: number; dismissed: number }>();
  for (const item of items) {
    confirmed += item.confirmed;
    dismissed += item.dismissed;
    if (item.confirmed + item.dismissed === 0) continue;
    const key = item.modelVersion ?? "모델 기록 없음";
    const m = models.get(key) ?? { confirmed: 0, dismissed: 0 };
    m.confirmed += item.confirmed;
    m.dismissed += item.dismissed;
    models.set(key, m);
  }
  const decided = confirmed + dismissed;
  return {
    checkpoints: items.length,
    confirmed,
    dismissed,
    precision: decided === 0 ? null : Math.round((confirmed / decided) * 100),
    byModel: [...models].map(([modelVersion, m]) => ({ modelVersion, ...m })),
  };
}

function Stat({ label, value, suffix = "", tone }: { label: string; value: number; suffix?: string; tone: string }) {
  const shown = useCountUp(value);
  return (
    <li className="grid gap-0.5 rounded-xl border bg-card px-3 py-2.5 shadow-xs md:p-4">
      <span className="text-[0.6875rem] whitespace-nowrap text-muted-foreground md:text-[0.8125rem]">{label}</span>
      <strong aria-hidden="true" className={`text-xl leading-tight font-bold tracking-tight tabular-nums md:text-2xl ${tone}`}>
        {shown}
        {suffix}
      </strong>
    </li>
  );
}

/**
 * 관리자 검사 결과 화면의 AI 성적표(11/11, UX 5). 사람이 검수를 끝낸 최근 시점에서
 * AI 후보를 몇 개 확정·기각했는지 보여 준다. 계약 변경 없이 검수 완료 목록(status=CONFIRMED)만 더한다
 */
export function AiScorecard() {
  // 검수를 끝낼 때마다 목록이 무효화되므로 따로 자주 다시 읽지 않는다
  const done = useReviewQueue("CONFIRMED", SCORECARD_LIMIT, 60_000);
  const items = done.data?.items ?? [];
  if (items.length === 0) return null;
  const score = scoreOf(items);
  const summary =
    `최근 검수 완료 ${score.checkpoints}건에서 AI 후보 ${score.confirmed}개를 흠집으로 확정하고 ${score.dismissed}개를 흠집 아님으로 정했습니다` +
    (score.precision === null ? "." : `. 확정 비율 ${score.precision}%.`);
  return (
    <section aria-labelledby="ai-scorecard-title" className="mb-6">
      <h2 id="ai-scorecard-title" className="mt-0 mb-2 text-base font-semibold tracking-tight">
        AI 후보 검수 결과
      </h2>
      <p className="sr-only">{summary}</p>
      <ul aria-hidden="true" className="m-0 grid list-none grid-cols-2 gap-2 p-0 md:grid-cols-4 md:gap-3">
        <Stat label="검수 완료 시점" value={score.checkpoints} tone="text-foreground" />
        <Stat label="흠집으로 확정" value={score.confirmed} tone="text-destructive" />
        <Stat label="흠집 아님" value={score.dismissed} tone="text-muted-foreground" />
        {score.precision !== null && <Stat label="확정 비율" value={score.precision} suffix="%" tone="text-foreground" />}
      </ul>
      <p className="mt-2 mb-0 text-xs text-muted-foreground">
        최근 {SCORECARD_LIMIT}건까지 · AI는 후보만 넓게 잡고, 사람이 확정한 흠집만 등급과 기록에 들어갑니다
        {score.byModel.length > 0 &&
          ` · ${score.byModel.map((m) => `${m.modelVersion} 확정 ${m.confirmed}·아님 ${m.dismissed}`).join(" / ")}`}
      </p>
    </section>
  );
}
