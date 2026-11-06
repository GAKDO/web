import { Link } from "react-router-dom";
import { ArrowRight, Check, Cpu, HardDrive, MemoryStick, MonitorSmartphone, Ruler } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RentalSummary, TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { isArchived } from "../../../shared/config/features";
import { maskSerial } from "../../../shared/ui/maskSerial";
import { useDeviceModel, useTimeline } from "../api/report";
import { CHECKPOINT_ORDER, orderedCheckpoints } from "../model/timeline";

const STATUS_TONE: Record<RentalSummary["status"], string> = {
  OPEN: "bg-brand-soft text-brand",
  RETURNED: "bg-success-soft text-success",
  CLOSED: "bg-muted text-muted-foreground",
};

function gradeText(cp: TimelineCheckpoint | undefined): string {
  if (!cp) return "진행 전";
  if (cp.grade) return cp.grade === "A" ? "문제 없음 · A" : `문제 있음 · ${cp.grade}`;
  return "검사 중";
}

/** 출고 → 수령 → 반납 세 단계를 한 줄로. 등급이 나온 단계는 채운 원, 진행 중은 테두리, 아직이면 흐리게 */
function CheckpointSteps({ checkpoints }: { checkpoints: TimelineCheckpoint[] }) {
  const byType = new Map(checkpoints.map((cp) => [cp.type, cp]));
  return (
    <ol aria-label="검사 단계" className="m-0 grid list-none grid-cols-3 gap-2 p-0">
      {CHECKPOINT_ORDER.map((type) => {
        const cp = byType.get(type);
        const done = !!cp?.grade;
        const bad = done && cp?.grade !== "A";
        return (
          <li key={type} className="min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                "mb-1.5 block h-1.5 rounded-full",
                done ? (bad ? "bg-destructive" : "bg-success") : cp ? "bg-brand/40" : "bg-muted",
              )}
            />
            <span className="flex items-center gap-1 text-xs font-semibold">
              {done && <Check aria-hidden="true" className="size-3.5" />}
              {CHECKPOINT_TYPE_LABEL[type]}
            </span>
            <span className={cn("block truncate text-xs", bad ? "text-destructive" : "text-muted-foreground")}>{gradeText(cp)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 마이페이지의 내 노트북 한 대. 기종 사양·치수는 GET /device-models/{modelCode}(고객 허용),
 * 단계별 등급은 리포트 타임라인에서 읽는다. 시리얼은 뒤 4자리만 보인다(11/6 팀 규칙)
 */
export function MyDeviceCard({ rental }: { rental: RentalSummary }) {
  const model = useDeviceModel(rental.modelCode);
  const timeline = useTimeline(rental.rentalId);
  const checkpoints = orderedCheckpoints(timeline.data?.checkpoints ?? []);
  const last = checkpoints.at(-1);
  const name = model.data?.name ?? rental.modelCode;
  const spec = model.data?.spec;
  const dims = model.data?.dimensions;
  const specs = [
    spec?.cpu && { icon: Cpu, label: "프로세서", value: spec.cpu },
    spec?.ramGb && { icon: MemoryStick, label: "메모리", value: `${spec.ramGb}GB` },
    spec?.ssdGb && { icon: HardDrive, label: "저장 공간", value: `${spec.ssdGb}GB SSD` },
    spec?.gpu && { icon: MonitorSmartphone, label: "그래픽", value: spec.gpu },
    dims && { icon: Ruler, label: "크기", value: `${dims.widthMm} × ${dims.depthMm} mm` },
  ].filter((s): s is { icon: typeof Cpu; label: string; value: string } => !!s);

  return (
    <li aria-label={name} className="flex flex-col rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs text-muted-foreground">{model.data?.manufacturer ?? "기종"}</p>
          <h3 className="m-0 mt-0.5 text-base font-bold break-keep">{name}</h3>
          <p className="m-0 mt-1 font-mono text-xs text-muted-foreground" aria-label={`시리얼 뒤 4자리 ${rental.serial.slice(-4)}`}>
            {maskSerial(rental.serial)}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_TONE[rental.status])}>
          {RENTAL_STATUS_LABEL[rental.status]}
        </span>
      </div>

      {specs.length > 0 && (
        <dl className="m-0 mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {specs.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <dt className="sr-only">{label}</dt>
              <dd className="m-0 min-w-0 text-sm leading-snug break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4">
        <CheckpointSteps checkpoints={checkpoints} />
        {last && (
          <p className="m-0 mt-2 text-xs text-muted-foreground">
            최근 {CHECKPOINT_TYPE_LABEL[last.type]}
            {last.grade ? ` · 등급 ${last.grade}` : " · 검사 중"}
          </p>
        )}
      </div>

      {!isArchived("report") && (
        <Link
          to={`/my/rentals/${rental.rentalId}`}
          className={cn(buttonVariants({ variant: "outline" }), "group mt-4 w-full no-underline")}
        >
          리포트 보기
          <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </li>
  );
}
