import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DeviceStatus, RentalSummary } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import {
  CHECKPOINT_STATUS_LABEL,
  CHECKPOINT_TYPE_LABEL,
  DEVICE_OS_LABEL,
  DEVICE_STATUS_LABEL,
  RENTAL_STATUS_LABEL,
} from "../../../shared/codes/labels";
import { DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { InfoList } from "../../../shared/ui/InfoList";
import { PageHeader, SectionTitle } from "../../../shared/ui/PageHeader";
import { Pager, usePaged } from "../../../shared/ui/Pager";
import { formatDate, formatDateTime } from "../../../shared/ui/format";
import { MaskedSerial } from "../../../shared/ui/MaskedSerial";
import { maskSerial } from "../../../shared/ui/maskSerial";
import { RENTAL_STATUS_VARIANT } from "../../rentals/components/RentalListPage";
import { useDevice, useDeviceRentals } from "../api/devices";

const STATUS_VARIANT = { ACTIVE: "success", MAINTENANCE: "warning", RETIRED: "secondary" } as const satisfies Record<DeviceStatus, string>;
const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "요청을 처리하지 못했습니다.");

/** 이력 행의 지금 시점. 옛 서버라 값이 없으면 빈칸 */
function currentStep(r: RentalSummary): string {
  if (r.currentCheckpoint === undefined) return "";
  if (r.currentCheckpoint === null) return "시작 전";
  return `${CHECKPOINT_TYPE_LABEL[r.currentCheckpoint.type]} · ${CHECKPOINT_STATUS_LABEL[r.currentCheckpoint.status]}`;
}

/** 기기 하나의 렌탈 이력 표. 행을 누르면 기존 렌탈 상세(세 시점·검사 결과)로 간다 */
function RentalHistory({ deviceId, serial }: { deviceId: string; serial: string }) {
  const rentals = useDeviceRentals(deviceId);
  const paged = usePaged(rentals, deviceId);
  const items = paged.items;
  return (
    <>
      {rentals.isError && <ErrorBanner message={toMessage(rentals.error)} onRetry={() => void rentals.refetch()} />}
      {rentals.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {rentals.isSuccess && items.length === 0 && <p className="text-muted-foreground">이 기기는 아직 렌탈한 적이 없습니다.</p>}
      <DataTable
        cols="1fr 0.8fr 1.2fr 1.3fr 1.3fr 0.9fr"
        labels={["대여자", "상태", "지금 시점", "출고 시작", "종료", "만든 날"]}
        label="렌탈 이력"
      >
        {items.map((r) => (
          <DataRow key={r.rentalId} label={r.renterRef ?? r.rentalId} className="grid-cols-1">
            <DataCells>
              <Link className="text-info underline-offset-4 hover:underline" to={`/admin/rentals/${r.rentalId}`} state={{ serial }}>
                <strong>{r.renterRef ?? "렌탈 상세"}</strong>
              </Link>
              <Badge variant={RENTAL_STATUS_VARIANT[r.status]}>{RENTAL_STATUS_LABEL[r.status]}</Badge>
              <span>{currentStep(r)}</span>
              <span className="tabular-nums">출고 {formatDateTime(r.startedAt)}</span>
              <span className="tabular-nums">종료 {formatDateTime(r.endedAt)}</span>
              <span className="text-muted-foreground tabular-nums">만든 날 {formatDate(r.createdAt)}</span>
            </DataCells>
          </DataRow>
        ))}
      </DataTable>
      <Pager paged={paged} label="렌탈 이력" />
    </>
  );
}

/** 기기 상세 + 기기별 렌탈 이력(11/6 강사님 피드백, contracts #28) */
export function DeviceDetailPage() {
  const { deviceId = "" } = useParams();
  const device = useDevice(deviceId);

  if (device.isPending) return <p className="text-muted-foreground">불러오는 중…</p>;
  const data = device.data;
  if (!data) return <ErrorBanner message={toMessage(device.error)} onRetry={() => void device.refetch()} />;

  return (
    <section>
      <PageHeader
        title={`기기 ${maskSerial(data.serial)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {data.modelName} · <Badge variant={STATUS_VARIANT[data.status]}>{DEVICE_STATUS_LABEL[data.status]}</Badge>
          </span>
        }
        actions={
          data.status === "ACTIVE" ? (
            <Link className={buttonVariants()} to="/admin/rentals/new" state={{ deviceId: data.deviceId }}>
              <Plus aria-hidden="true" />이 기기로 렌탈 만들기
            </Link>
          ) : undefined
        }
      />
      <p className="mb-4">
        <Link className="text-info underline-offset-4 hover:underline" to="/admin/devices">
          ← 기기 목록
        </Link>
      </p>
      <SectionTitle>기기 정보</SectionTitle>
      <InfoList
        className="rounded-xl border bg-card p-5 shadow-xs"
        items={[
          ["시리얼", <MaskedSerial key="serial" serial={data.serial} />],
          ["기종", data.modelName],
          ["OS", DEVICE_OS_LABEL[data.os]],
          ["색상", data.color ?? "없음"],
          ["자산번호", data.assetNo ?? "없음"],
          ["등록일", formatDate(data.createdAt)],
          ["폐기일", data.retiredAt ? formatDate(data.retiredAt) : "—"],
        ]}
      />
      <SectionTitle>렌탈 이력</SectionTitle>
      <RentalHistory deviceId={data.deviceId} serial={data.serial} />
    </section>
  );
}
