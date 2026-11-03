import { Link } from "react-router-dom";
import type { RentalSummary } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { isArchived } from "../../../shared/config/features";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModel, useMyRentals, useTimeline } from "../api/report";
import { orderedCheckpoints } from "../model/timeline";

function RentalCard({ rental }: { rental: RentalSummary }) {
  const model = useDeviceModel(rental.modelCode);
  const timeline = useTimeline(rental.rentalId);
  const last = orderedCheckpoints(timeline.data?.checkpoints ?? []).at(-1);
  const name = model.data?.name ?? rental.modelCode;
  return (
    <li className="card" aria-label={name}>
      <div className="card-main">
        <strong>{name}</strong>
        <span className="badge">{RENTAL_STATUS_LABEL[rental.status]}</span>
        {last && (
          <span>
            최근 {CHECKPOINT_TYPE_LABEL[last.type]}
            {last.grade ? ` · 등급 ${last.grade}` : " · 검사 중"}
          </span>
        )}
      </div>
      {/* 3D 리포트(WE3)를 보관하면 목록에서도 리포트 링크를 숨긴다 */}
      {!isArchived("report") && (
        <Link className="button-link" to={`/my/rentals/${rental.rentalId}`}>
          리포트 보기
        </Link>
      )}
    </li>
  );
}

/** 고객의 내 렌탈 목록(FR-USR-03). 서버가 고객에게는 자기 렌탈만 준다 */
export function MyRentalsPage() {
  const rentals = useMyRentals();
  const items = rentals.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <main className="page narrow">
      <h1>내 렌탈</h1>
      {rentals.isPending && <p>불러오는 중…</p>}
      {rentals.isError && (
        <ErrorBanner
          message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void (rentals.isFetchNextPageError ? rentals.fetchNextPage() : rentals.refetch())}
        />
      )}
      {rentals.isSuccess && items.length === 0 && <p>아직 렌탈 기록이 없습니다.</p>}
      <ul className="cards">
        {items.map((rental) => <RentalCard key={rental.rentalId} rental={rental} />)}
      </ul>
      {rentals.hasNextPage && (
        <Button busy={rentals.isFetchingNextPage} disabled={rentals.isFetching} onClick={() => void rentals.fetchNextPage()}>
          더 보기
        </Button>
      )}
      <p className="muted">
        <Link to="/my/account/withdraw">계정 탈퇴</Link>
      </p>
    </main>
  );
}
