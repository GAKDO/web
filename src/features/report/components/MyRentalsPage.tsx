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

const FLOW = [
  { title: "출고 검사", text: "노트북을 내보내기 전에 부스에서 윗면·바닥을 찍고 흠집을 찾아 둡니다." },
  { title: "수령 확인", text: "받았을 때 상태를 한 번 더 남겨, 처음부터 있던 흠집을 구분합니다." },
  { title: "반납 비교", text: "돌려줄 때 처음 사진과 비교해 새로 생긴 흠집만 보여 줍니다." },
];

/** 아직 렌탈이 연결되지 않은 고객에게: 고장 난 화면처럼 보이지 않게, 무엇이 쌓일지와 다음에 할 일을 보여 준다 */
function EmptyRentals({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <section aria-labelledby="empty-rentals" className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <h2 id="empty-rentals" className="!mt-0 !mb-1 text-lg font-bold">
        아직 연결된 렌탈이 없습니다
      </h2>
      <p className="m-0 text-sm text-muted-foreground">
        노트북을 빌리면 그 렌탈이 이 계정에 연결되고, 아래 세 번의 검사 결과가 여기에 차례로 쌓입니다.
      </p>
      <ol className="m-0 mt-5 grid list-none gap-3 p-0 md:grid-cols-3">
        {FLOW.map((step, i) => (
          <li key={step.title} className="rounded-xl border border-border bg-background p-4">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <strong className="mt-2 block">{step.title}</strong>
            <span className="mt-1 block text-sm text-muted-foreground">{step.text}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-5 text-sm">
        노트북은 렌탈 창구에서 빌리고, 받을 때 직원이 보여 주는 QR을 폰으로 찍으면 이 계정에 연결됩니다.{" "}
        <Link to="/guide">이용 안내 보기</Link>
      </p>
      <p className="m-0 mt-2 text-sm">렌탈을 받은 뒤에도 비어 있으면 새로 고침을 눌러 보세요. 연결되면 바로 여기에 보입니다.</p>
      <div className="mt-3">
        <Button busy={refreshing} disabled={refreshing} onClick={onRefresh}>
          새로 고침
        </Button>
      </div>
    </section>
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
      {rentals.isSuccess && items.length === 0 && <EmptyRentals onRefresh={() => void rentals.refetch()} refreshing={rentals.isFetching} />}
      <ul className="cards">
        {items.map((rental) => <RentalCard key={rental.rentalId} rental={rental} />)}
      </ul>
      {rentals.hasNextPage && (
        <Button busy={rentals.isFetchingNextPage} disabled={rentals.isFetching} onClick={() => void rentals.fetchNextPage()}>
          더 보기
        </Button>
      )}
      {!isArchived("account") && (
        <p className="muted">
          <Link to="/my/account/withdraw">계정 탈퇴</Link>
        </p>
      )}
    </main>
  );
}
