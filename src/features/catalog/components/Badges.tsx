import { cn } from "@/lib/utils";
import type { CatalogDevice, Grade } from "../../../shared/api/types";
import { GRADE_MEANING, GRADE_TONE } from "../model/format";

// 11/10: 상태·등급이 모두 같은 둥근 알약 모양이라 "만든 티"가 나고 C등급이 잘 안 보인다는 피드백.
// 등급은 테두리 있는 작은 칸(글자 대비 AA 이상), 대여 상태는 점 + 글자로 나눠 한눈에 다르게 읽히게 했다.

/** 등급 칸. withMeaning이면 "C등급 · 수리 검토"처럼 뜻도 함께(상세 머리) */
export function GradeBadge({ grade, withMeaning = false }: { grade: Grade | null; withMeaning?: boolean }) {
  if (!grade)
    return <span className="inline-flex items-center rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground">검사 전</span>;
  return (
    <span title={`${grade}등급: ${GRADE_MEANING[grade]}`} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold whitespace-nowrap", GRADE_TONE[grade])}>
      {grade}등급
      {withMeaning ? <span className="font-medium">· {GRADE_MEANING[grade]}</span> : <span className="sr-only">({GRADE_MEANING[grade]})</span>}
    </span>
  );
}

const DOT = "size-2 shrink-0 rounded-full";

/** 대여 가능·대여 중·정비 중. 대여자는 알 수 없고 알리지 않는다 */
export function AvailabilityBadge({ device }: { device: CatalogDevice }) {
  if (device.available)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-emerald-800">
        <span aria-hidden="true" className={cn(DOT, "bg-emerald-600")} />
        대여 가능
      </span>
    );
  const maintenance = device.status === "MAINTENANCE";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
      <span aria-hidden="true" className={cn(DOT, maintenance ? "bg-amber-500" : "bg-zinc-400")} />
      {maintenance ? "정비 중" : "대여 중"}
    </span>
  );
}
