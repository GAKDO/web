import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModels } from "../../devices/api/devices";
import { useRentals } from "../../rentals/api/rentals";
import { INSPECTIONS } from "../api/inspections";
import { VerdictBadge } from "./VerdictBadge";
import { DataTable } from "../../../shared/ui/DataTable";
import { formatDateTime } from "../../../shared/ui/format";

/** 상세에서 이 목록으로 돌아올 곳 */
const LIST_BACK = { path: "/admin/inspections", label: "검사 결과 목록으로" };

/**
 * 검사 결과 목록(spec 006 US1). 전용 API가 없어 렌탈 목록(최근 것부터)의 지금 시점으로 기기별 최근 검사를 보인다.
 * MVP(11/3): 부스가 위·아래 2면을 찍어 올리면 capture-server가 등급을 매기고, 여기서 문제 있음/없음을 본다.
 * 열어 둔 동안 목록은 5초마다, 판정 대기 카드는 3초마다 다시 읽고, 새로 고침으로 바로 다시 읽을 수도 있다.
 */
export function InspectionListPage() {
  const client = useQueryClient();
  const rentals = useRentals(undefined, { live: true });
  const models = useDeviceModels();
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  const items = rentals.data?.pages.flatMap((page) => page.items) ?? [];
  const refresh = () => {
    void rentals.refetch();
    void client.invalidateQueries({ queryKey: INSPECTIONS });
  };

  return (
    <section>
      <h1>검사 결과</h1>
      <div className="row">
        <p className="muted">기기(렌탈)마다 지금 시점의 판정입니다. 문제 있음은 등급 B~D, 문제 없음은 A입니다. 열어 두면 저절로 갱신됩니다.</p>
        <Button onClick={refresh}>새로 고침</Button>
      </div>
      {rentals.isError && (
        <ErrorBanner
          message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void rentals.refetch()}
        />
      )}
      {rentals.isPending && <p>불러오는 중…</p>}
      {rentals.isSuccess && items.length === 0 && <p>검사할 렌탈이 없습니다. 렌탈을 먼저 만들어 주세요.</p>}
      <DataTable cols="1.1fr minmax(110px, 1fr) 1.4fr 1.1fr 1.3fr 120px" labels={["검사 시각", "시리얼", "기기명", "지금 시점", "판정", ""]}>
        <ul className="cards table-list" aria-label="검사 결과">
          {items.map((r) => {
            const checkpoint = r.currentCheckpoint ?? null;
            return (
              <li key={r.rentalId} className="card" aria-label={r.serial}>
                <div className="card-main">
                  <span>{checkpoint ? formatDateTime(checkpoint.occurredAt) : "—"}</span>
                  <strong>{r.serial}</strong>
                  <span>{modelName(r.modelCode)}</span>
                  <span>{checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} · ${CHECKPOINT_STATUS_LABEL[checkpoint.status]}` : "시점 없음"}</span>
                  <VerdictBadge checkpoint={checkpoint} />
                </div>
                <div className="row">
                  {checkpoint ? (
                    <Link
                      className="button-link"
                      to={`/admin/inspections/${r.rentalId}/${checkpoint.checkpointId}`}
                      state={{ serial: r.serial, backTo: LIST_BACK }}
                    >
                      결과 보기
                    </Link>
                  ) : (
                    <Link className="button-link" to={`/admin/rentals/${r.rentalId}`} state={{ serial: r.serial }}>
                      렌탈 열기
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </DataTable>
      {rentals.hasNextPage && (
        <Button busy={rentals.isFetchingNextPage} onClick={() => void rentals.fetchNextPage()}>
          더 보기
        </Button>
      )}
    </section>
  );
}
