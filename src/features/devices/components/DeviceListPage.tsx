import { maskSerial } from "../../../shared/ui/maskSerial";
import { MaskedSerial } from "../../../shared/ui/MaskedSerial";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Device, DeviceStatus } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_OS_LABEL, DEVICE_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useDeviceModels, useDevices } from "../api/devices";
import { TotalCount } from "../../../shared/ui/TotalCount";
import { DeviceEditor } from "./DeviceEditor";
import { StatusMenu } from "./StatusMenu";
import { DataActions, DataCells, DataDetail, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { InfoList } from "../../../shared/ui/InfoList";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { FilterPanel } from "../../../shared/ui/FilterPanel";
import { Pager, usePaged } from "../../../shared/ui/Pager";
import { formatDate } from "../../../shared/ui/format";

/** 입력이 멈춘 뒤에만 검색한다 */
function useDebounced(value: string, ms = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** 기기 상태 배지 색: 사용 가능 초록, 수리 중 노랑, 폐기 회색 */
const STATUS_VARIANT = { ACTIVE: "success", MAINTENANCE: "warning", RETIRED: "secondary" } as const satisfies Record<DeviceStatus, string>;

function DeviceCard({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const panelId = `device-${device.deviceId}-detail`;
  return (
    <DataRow label={device.serial}>
      <DataCells>
        <span>{device.modelName}</span>
        {/* 화면에는 뒤 4자리만, 읽어 주기는 행 이름(DataRow)과 같은 전체 시리얼 */}
        <Link className="text-info underline-offset-4 hover:underline" to={`/admin/devices/${device.deviceId}`} aria-label={device.serial}>
          <strong title="시리얼(뒤 4자리)">{maskSerial(device.serial)}</strong>
        </Link>
        <Badge variant={STATUS_VARIANT[device.status]}>{DEVICE_STATUS_LABEL[device.status]}</Badge>
        <span className="text-muted-foreground tabular-nums">{formatDate(device.createdAt)}</span>
      </DataCells>
      <DataActions>
        <Button size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
          {open ? "닫기" : "상세보기"}
        </Button>
      </DataActions>
      {/* 상세보기: 별도 페이지 없이 같은 줄 아래에 기본 정보와 상태 바꾸기·고치기를 펼친다 */}
      {open && (
        <DataDetail id={panelId}>
          {editing ? (
            <DeviceEditor device={device} onDone={() => setEditing(false)} />
          ) : (
            <>
              <InfoList
                items={[
                  // 펼친 상세에서도 가려 두고 눈 버튼을 눌러야 전체가 보인다
                  ["시리얼", <MaskedSerial key="serial" serial={device.serial} />],
                  ["OS", DEVICE_OS_LABEL[device.os]],
                  ["색상", device.color ?? "없음"],
                  ["자산번호", device.assetNo ?? "없음"],
                  ["등록일", formatDate(device.createdAt)],
                  ["고친 날", formatDate(device.updatedAt)],
                ]}
              />
              <div className="flex flex-wrap items-start gap-2">
                <StatusMenu device={device} />
                <Button onClick={() => setEditing(true)}>고치기</Button>
                <Link className={buttonVariants({ variant: "outline" })} to={`/admin/devices/${device.deviceId}`}>
                  렌탈 이력
                </Link>
              </div>
            </>
          )}
        </DataDetail>
      )}
    </DataRow>
  );
}

export function DeviceListPage() {
  const [modelCode, setModelCode] = useState("");
  const [status, setStatus] = useState<DeviceStatus | "">("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const models = useDeviceModels();
  const devices = useDevices({
    modelCode: modelCode || undefined,
    status: status || undefined,
    q,
  });
  const paged = usePaged(devices, `${modelCode}|${status}|${q}`);
  const items = paged.items;
  const active = (modelCode ? 1 : 0) + (status ? 1 : 0);

  return (
    <section>
      <PageHeader
        title="기기 목록"
        actions={
          <Link className={buttonVariants()} to="/admin/devices/new">
            <Plus aria-hidden="true" />
            기기 등록
          </Link>
        }
      />
      <FilterPanel
        active={active}
        cols="1fr 1fr 2fr"
        onReset={() => {
          setModelCode("");
          setStatus("");
        }}
        inline={<Field label="검색" type="search" placeholder="시리얼·자산번호 일부" maxLength={64} value={search} onChange={(e) => setSearch(e.target.value)} />}
      >
        <SelectField label="기종" value={modelCode} onChange={(e) => setModelCode(e.target.value)}>
          <option value="">전체</option>
          {models.data?.map((m) => (
            <option key={m.modelCode} value={m.modelCode}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="상태" value={status} onChange={(e) => setStatus(e.target.value as DeviceStatus | "")}>
          <option value="">전체</option>
          {Object.entries(DEVICE_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

      </FilterPanel>
      {devices.isError && (
        <ErrorBanner
          message={devices.error instanceof ApiError ? messageFor(devices.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void devices.refetch()}
        />
      )}
      {devices.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {devices.isSuccess && items.length === 0 && <p className="text-muted-foreground">조건에 맞는 기기가 없습니다.</p>}
      {devices.isSuccess && items.length > 0 && <TotalCount query={devices} />}
      <DataTable cols="1.6fr minmax(110px, 1fr) 0.8fr 0.9fr 120px" labels={["기기명", "시리얼번호", "상태", "등록일", ""]} label="기기">
        {items.map((device) => (
          <DeviceCard key={device.deviceId} device={device} />
        ))}
      </DataTable>
      <Pager paged={paged} label="기기" />
    </section>
  );
}
