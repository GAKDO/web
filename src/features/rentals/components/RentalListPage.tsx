import { maskSerial } from "../../../shared/ui/maskSerial";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { RentalStatus, RentalSummary } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { SelectField } from "../../../shared/ui/Field";
import { useDeviceModels } from "../../devices/api/devices";
import { useRentals } from "../api/rentals";
import { DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { FilterPanel } from "../../../shared/ui/FilterPanel";
import { Pager, usePaged } from "../../../shared/ui/Pager";
import { formatDate } from "../../../shared/ui/format";

export { formatDate };

/** 렌탈 상태 배지 색: 진행 중 파랑, 반납됨(종료 대기) 노랑, 종료 회색 */
export const RENTAL_STATUS_VARIANT = { OPEN: "info", RETURNED: "warning", CLOSED: "secondary" } as const satisfies Record<RentalSummary["status"], string>;

/** 지금 시점(시작된 시점 중 가장 뒤). 없으면 시작 전, 옛 서버라 값이 안 오면 표시하지 않는다 */
function currentStep(r: RentalSummary): string | null {
  if (r.currentCheckpoint === undefined) return null;
  if (r.currentCheckpoint === null) return "지금 시점: 시작 전";
  return `지금 시점: ${CHECKPOINT_TYPE_LABEL[r.currentCheckpoint.type]} · ${CHECKPOINT_STATUS_LABEL[r.currentCheckpoint.status]}`;
}

/** 렌탈 목록: 계약 RentalSummary의 시리얼·기종·상태·지금 시점·만든 날(FR-021). ?status=OPEN으로 거른다 */
export function RentalListPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  // 계약에 없는 값(?status=INVALID)은 거르지 않고 전체를 보인다
  const status = raw && Object.hasOwn(RENTAL_STATUS_LABEL, raw) ? (raw as RentalStatus) : undefined;
  const rentals = useRentals(status);
  const models = useDeviceModels();
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  const paged = usePaged(rentals, status ?? "");
  const items = paged.items;

  return (
    <section>
      <PageHeader
        title="렌탈 목록"
        actions={
          <Link className={buttonVariants()} to="/admin/rentals/new">
            <Plus aria-hidden="true" />
            렌탈 만들기
          </Link>
        }
      />
      <FilterPanel active={status ? 1 : 0} onReset={() => setParams({}, { preventScrollReset: true })}>
        <SelectField label="렌탈 상태" value={status ?? ""} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {}, { preventScrollReset: true })}>
          <option value="">전체</option>
          {Object.entries(RENTAL_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </FilterPanel>
      {rentals.isError && (
        <ErrorBanner
          message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void rentals.refetch()}
        />
      )}
      {rentals.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {rentals.isSuccess && items.length === 0 && <p className="text-muted-foreground">렌탈이 없습니다.</p>}
      <DataTable cols="minmax(110px, 1fr) 1.5fr 0.7fr 1.6fr 1fr" labels={["시리얼", "기종", "상태", "지금 시점", "만든 날"]} label="렌탈">
        {items.map((r) => (
          <DataRow key={r.rentalId} label={r.serial} className="grid-cols-1">
            <DataCells>
              <Link className="text-info underline-offset-4 hover:underline" to={`/admin/rentals/${r.rentalId}`} state={{ serial: r.serial }}>
                <strong>{maskSerial(r.serial)}</strong>
              </Link>
              <span>{modelName(r.modelCode)}</span>
              <Badge variant={RENTAL_STATUS_VARIANT[r.status]}>{RENTAL_STATUS_LABEL[r.status]}</Badge>
              <span>{currentStep(r)}</span>
              <span className="text-muted-foreground tabular-nums">만든 날 {formatDate(r.createdAt)}</span>
            </DataCells>
          </DataRow>
        ))}
      </DataTable>
      <Pager paged={paged} label="렌탈" />
    </section>
  );
}
