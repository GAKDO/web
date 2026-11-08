import { cn } from "@/lib/utils";
import type { CatalogDevice, Grade } from "../../../shared/api/types";
import { GRADE_TONE } from "../model/format";

const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

export function GradeBadge({ grade }: { grade: Grade | null }) {
  if (!grade) return <span className={cn(PILL, "bg-muted text-muted-foreground")}>검사 전</span>;
  return <span className={cn(PILL, GRADE_TONE[grade])}>{grade}등급</span>;
}

/** 대여 가능·대여 중·정비 중. 대여자는 알 수 없고 알리지 않는다 */
export function AvailabilityBadge({ device }: { device: CatalogDevice }) {
  if (device.available) return <span className={cn(PILL, "bg-emerald-600 text-white")}>대여 가능</span>;
  if (device.status === "MAINTENANCE") return <span className={cn(PILL, "bg-muted text-muted-foreground")}>정비 중</span>;
  return <span className={cn(PILL, "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900")}>대여 중</span>;
}
