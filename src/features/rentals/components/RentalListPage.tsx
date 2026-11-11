import { maskSerial } from "../../../shared/ui/maskSerial";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { RentalStatus, RentalSummary } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, INSPECTION_GRADE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
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
import { TotalCount } from "../../../shared/ui/TotalCount";
import { dueState } from "../dueDate";
import { LoadingRows } from "../../../shared/ui/LoadingRows";

export { formatDate };

/** 렌탈 상태 배지 색: 진행 중 파랑, 반납됨(종료 대기) 노랑, 종료 회색 */
export const RENTAL_STATUS_VARIANT = { OPEN: "info", RETURNED: "warning", CLOSED: "secondary" } as const satisfies Record<RentalSummary["status"], string>;

/** 지금 시점(시작된 시점 중 가장 뒤). 없으면 시작 전, 옛 서버라 값이 안 오면 표시하지 않는다 */
function currentStep(r: RentalSummary): string | null {
  if (r.currentCheckpoint === undefined) return null;
  if (r.currentCheckpoint === null) return "지금 시점: 시작 전";
  return `지금 시점: ${CHECKPOINT_TYPE_LABEL[r.currentCheckpoint.type]} · ${CHECKPOINT_STATUS_LABEL[r.currentCheckpoint.status]}`;
}

/**
 * 지금 시점 검사 등급(11/10, contracts #42). "문제 있는 것만"으로 걸렀을 때 왜 걸렸는지 목록에서 바로 보이게 한다.
 * 등급은 서버 값 그대로(A 문제 없음, B~D 문제 있음). 누르면 그 시점 검사 결과로 간다
 */
function GradeCell({ rental }: { rental: RentalSummary }) {
  const cp = rental.currentCheckpoint;
  if (!cp) return <span className="text-muted-foreground">—</span>;
  const grade = cp.grade ?? null;
  if (grade === null) return <span className="text-muted-foreground">등급 전</span>;
  const bad = grade !== "A";
  return (
    <Link to={`/admin/inspections/${rental.rentalId}/${cp.checkpointId}`} state={{ serial: rental.serial }} aria-label={`${rental.serial} 검사 결과 보기: ${bad ? "문제 있음" : "문제 없음"} · ${INSPECTION_GRADE_LABEL[grade]}`} className="justify-self-start">
      <Badge variant={bad ? "destructive" : "success"}>
        {bad ? "문제 있음" : "문제 없음"} · {INSPECTION_GRADE_LABEL[grade]}
      </Badge>
    </Link>
  );
}

/** 반납 예정일. 진행 중인데 지났으면 경고색으로 "지남"을 붙이고, 없으면 만든 날을 흐리게 보인다 */
function DueDate({ rental }: { rental: RentalSummary }) {
  const due = dueState(rental);
  if (!due) return <span className="text-muted-foreground tabular-nums">만든 날 {formatDate(rental.createdAt)}</span>;
  return (
    <span className={due.overdue ? "font-medium text-destructive tabular-nums" : "tabular-nums"}>
      반납 예정 {due.label}
      {due.overdue ? " · 지남" : ""}
    </span>
  );
}

/** 렌탈 목록: 계약 RentalSummary의 시리얼·기종·상태·지금 시점·만든 날(FR-021). ?status=OPEN으로 거른다 */
export function RentalListPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  // 계약에 없는 값(?status=INVALID)은 거르지 않고 전체를 보인다
  const status = raw && Object.hasOwn(RENTAL_STATUS_LABEL, raw) ? (raw as RentalStatus) : undefined;
  // 검사 결과 화면과 같은 "문제 있는 것만"(지금 시점 등급 B·C·D, contracts #23). 렌탈 목록에서도 찾기 쉽게 둔다
  const problemOnly = params.get("problem") === "1";
  const rentals = useRentals(status, { problem: problemOnly });
  const models = useDeviceModels();
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  const paged = usePaged(rentals, `${status ?? ""}|${problemOnly ? "problem" : ""}`);
  const items = paged.items;
  const setFilter = (key: "status" | "problem", value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { preventScrollReset: true },
    );

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
      <FilterPanel active={(status ? 1 : 0) + (problemOnly ? 1 : 0)} onReset={() => setParams({}, { preventScrollReset: true })}>
        <SelectField label="렌탈 상태" value={status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">전체</option>
          {Object.entries(RENTAL_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="검사 등급" value={problemOnly ? "1" : ""} onChange={(e) => setFilter("problem", e.target.value)}>
          <option value="">전체</option>
          <option value="1">문제 있는 것만 (B·C·D)</option>
        </SelectField>
      </FilterPanel>
      {rentals.isError && (
        <ErrorBanner
          message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void rentals.refetch()}
        />
      )}
      {rentals.isPending && <LoadingRows label="렌탈 목록을 불러오는 중…" />}
      {rentals.isSuccess && items.length === 0 && (
        <p className="text-muted-foreground">{problemOnly ? "지금 문제 있는 렌탈이 없습니다. 지금 시점 등급이 B·C·D인 렌탈만 여기에 보입니다." : "렌탈이 없습니다."}</p>
      )}
      {rentals.isSuccess && items.length > 0 && <TotalCount query={rentals} label={problemOnly ? "문제 있는 렌탈 총" : "총"} />}
      <DataTable cols="minmax(110px, 1fr) 1.2fr 0.8fr 0.7fr 1.4fr 1.1fr 1fr" labels={["시리얼", "기종", "고객", "상태", "지금 시점", "검사 결과", "반납 예정·만든 날"]} label="렌탈">
        {items.map((r) => (
          <DataRow key={r.rentalId} label={r.serial} className="grid-cols-1">
            <DataCells>
              <Link className="text-info underline-offset-4 hover:underline" to={`/admin/rentals/${r.rentalId}`} state={{ serial: r.serial }}>
                <strong>{maskSerial(r.serial)}</strong>
              </Link>
              <span>{modelName(r.modelCode)}</span>
              <span className={r.customerName ? undefined : "text-muted-foreground"}>{r.customerName || "—"}</span>
              <Badge variant={RENTAL_STATUS_VARIANT[r.status]}>{RENTAL_STATUS_LABEL[r.status]}</Badge>
              <span>{currentStep(r)}</span>
              <GradeCell rental={r} />
              <DueDate rental={r} />
            </DataCells>
          </DataRow>
        ))}
      </DataTable>
      <Pager paged={paged} label="렌탈" />
    </section>
  );
}
