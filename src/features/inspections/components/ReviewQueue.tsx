import { buttonVariants } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { DefectReviewQueueItem } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { formatDateTime } from "../../../shared/ui/format";
import { maskSerial } from "../../../shared/ui/maskSerial";
import { useRental } from "../../rentals/api/rentals";
import { useReviewQueue } from "../api/reviews";
import type { BackTo } from "./InspectionDetailPage";

function QueueRow({ item, backTo }: { item: DefectReviewQueueItem; backTo: BackTo }) {
  const rental = useRental(item.rentalId);
  const checkpoint = rental.data?.checkpoints.find((c) => c.checkpointId === item.checkpointId);
  const serial = rental.data?.serial ?? "";
  const left = item.pending;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs" aria-label={`검수 대기 ${serial ? maskSerial(serial) : item.checkpointId}`}>
      <div className="grid gap-0.5 text-sm">
        <strong>
          {serial ? maskSerial(serial) : "기기 확인 중…"}
          {checkpoint && ` · ${CHECKPOINT_TYPE_LABEL[checkpoint.type]}`}
        </strong>
        <span className="text-muted-foreground">
          AI 후보 사진 {item.pending + item.confirmed + item.dismissed}장 · 남은 {left}장{item.completedAt && ` · 촬영 ${formatDateTime(item.completedAt)}`}
        </span>
      </div>
      <Link className={buttonVariants({ variant: "default", size: "sm" })} to={`/admin/inspections/${item.rentalId}/${item.checkpointId}`} state={{ serial, backTo }}>
        검수하기
      </Link>
    </li>
  );
}

/** 검사 결과 맨 위: 사람 검수를 기다리는 시점(11/8). 없으면 아무것도 보이지 않는다 */
export function ReviewQueue({ backTo }: { backTo: BackTo }) {
  const queue = useReviewQueue("PENDING");
  const items = queue.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="review-queue-title" className="mb-6 rounded-xl border-2 border-warning/40 bg-warning-soft/40 p-4">
      <h2 id="review-queue-title" className="mt-0 mb-2 text-lg font-semibold tracking-tight">사람 검수 대기 · {items.length}건</h2>
      <p className="mt-0 text-sm text-muted-foreground">AI가 흠집일 수 있는 곳을 잡았어요. 사람이 확인해야 판정과 기록 봉인이 끝납니다.</p>
      <ul className="m-0 grid list-none gap-2 p-0" aria-label="검수 대기">
        {items.map((item) => (
          <QueueRow key={item.checkpointId} item={item} backTo={backTo} />
        ))}
      </ul>
    </section>
  );
}
