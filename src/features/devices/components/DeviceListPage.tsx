import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Device, DeviceStatus } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_OS_LABEL, DEVICE_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useDeviceModels, useDevices } from "../api/devices";
import { DeviceEditor } from "./DeviceEditor";
import { StatusMenu } from "./StatusMenu";
import { DataTable } from "../../../shared/ui/DataTable";
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

function DeviceCard({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const panelId = `device-${device.deviceId}-detail`;
  return (
    <li className="card" aria-label={device.serial}>
      <div className="card-main">
        <span>{device.modelName}</span>
        <strong>{device.serial}</strong>
        <span className={`badge badge-${device.status.toLowerCase()}`}>{DEVICE_STATUS_LABEL[device.status]}</span>
        <span>{formatDate(device.createdAt)}</span>
      </div>
      <div className="row">
        <Button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
          {open ? "닫기" : "상세보기"}
        </Button>
      </div>
      {/* 상세보기: 별도 페이지 없이 같은 줄 아래에 기본 정보와 상태 바꾸기·고치기를 펼친다 */}
      {open && (
        <div id={panelId} className="detail-panel">
          {editing ? (
            <DeviceEditor device={device} onDone={() => setEditing(false)} />
          ) : (
            <>
              <dl className="info-list">
                <dt>OS</dt>
                <dd>{DEVICE_OS_LABEL[device.os]}</dd>
                <dt>색상</dt>
                <dd>{device.color ?? "없음"}</dd>
                <dt>자산번호</dt>
                <dd>{device.assetNo ?? "없음"}</dd>
                <dt>등록일</dt>
                <dd>{formatDate(device.createdAt)}</dd>
                <dt>고친 날</dt>
                <dd>{formatDate(device.updatedAt)}</dd>
              </dl>
              <div className="row">
                <StatusMenu device={device} />
                <Button onClick={() => setEditing(true)}>고치기</Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
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
  const items = devices.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section>
      <div className="row heading-row">
        <h1>기기 목록</h1>
        <Link className="button-link primary" to="/admin/devices/new">
          기기 등록
        </Link>
      </div>
      <div className="filters">
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
        <Field label="검색" type="search" placeholder="시리얼·자산번호 일부" maxLength={64} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {devices.isError && (
        <ErrorBanner
          message={devices.error instanceof ApiError ? messageFor(devices.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void devices.refetch()}
        />
      )}
      {devices.isPending && <p>불러오는 중…</p>}
      {devices.isSuccess && items.length === 0 && <p>조건에 맞는 기기가 없습니다.</p>}
      <DataTable cols="1.6fr minmax(110px, 1fr) 0.8fr 0.9fr 120px" labels={["기기명", "시리얼번호", "상태", "등록일", ""]}>
        <ul className="cards table-list" aria-label="기기">
          {items.map((device) => (
            <DeviceCard key={device.deviceId} device={device} />
          ))}
        </ul>
      </DataTable>
      {devices.hasNextPage && (
        <Button busy={devices.isFetchingNextPage} onClick={() => void devices.fetchNextPage()}>
          더 보기
        </Button>
      )}
    </section>
  );
}
