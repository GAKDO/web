import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModels } from "../../devices/api/devices";
import { useRentals } from "../../rentals/api/rentals";
import { INSPECTIONS } from "../api/inspections";
import { VerdictBadge } from "./VerdictBadge";
import { VerdictSummary } from "./VerdictSummary";
import { DataActions, DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { Pager, usePaged } from "../../../shared/ui/Pager";
import { formatDateTime } from "../../../shared/ui/format";


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
  const paged = usePaged(rentals);
  // 상세에서 목록 링크로 돌아오면 보던 쪽(?page=N)으로
  const { search } = useLocation();
  const listBack = { path: `/admin/inspections${search}`, label: "검사 결과 목록으로" };
  const items = paged.items;
  const refresh = () => {
    void rentals.refetch();
    void client.invalidateQueries({ queryKey: INSPECTIONS });
  };

  return (
    <section>
      <PageHeader
        title="검사 결과"
        description="기기(렌탈)마다 지금 시점의 판정입니다. 문제 있음은 등급 B~D, 문제 없음은 A입니다. 열어 두면 저절로 갱신됩니다."
        actions={
          <Button onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            새로 고침
          </Button>
        }
      />
      {rentals.isError && (
        <ErrorBanner
          message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void rentals.refetch()}
        />
      )}
      {rentals.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {items.length > 0 && <VerdictSummary items={items} hasMore={paged.canNext} />}
      {rentals.isSuccess && items.length === 0 && <p className="text-muted-foreground">검사할 렌탈이 없습니다. 렌탈을 먼저 만들어 주세요.</p>}
      <DataTable cols="minmax(150px, 1.2fr) minmax(110px, 1fr) 1.4fr 1.1fr 1.3fr 110px" labels={["검사 시각", "시리얼", "기기명", "지금 시점", "판정", ""]} label="검사 결과">
        {items.map((r) => {
          const checkpoint = r.currentCheckpoint ?? null;
          return (
            <DataRow key={r.rentalId} label={r.serial}>
              <DataCells>
                <span className="text-muted-foreground tabular-nums">{checkpoint ? formatDateTime(checkpoint.occurredAt) : "—"}</span>
                <strong>{r.serial}</strong>
                <span>{modelName(r.modelCode)}</span>
                <span>{checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} · ${CHECKPOINT_STATUS_LABEL[checkpoint.status]}` : "시점 없음"}</span>
                <VerdictBadge checkpoint={checkpoint} />
              </DataCells>
              <DataActions>
                {checkpoint ? (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    to={`/admin/inspections/${r.rentalId}/${checkpoint.checkpointId}`}
                    state={{ serial: r.serial, backTo: listBack }}
                  >
                    결과 보기
                  </Link>
                ) : (
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/admin/rentals/${r.rentalId}`} state={{ serial: r.serial }}>
                    렌탈 열기
                  </Link>
                )}
              </DataActions>
            </DataRow>
          );
        })}
      </DataTable>
      <Pager paged={paged} label="검사 결과" />
    </section>
  );
}
