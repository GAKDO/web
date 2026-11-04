import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Device } from "../../../shared/api/types";
import { ApiError, networkError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useDevices } from "../../devices/api/devices";
import { useCreateRental } from "../api/rentals";

/** 기기와 대여자 참조 번호로 렌탈을 만든다. 기본은 사용 가능 기기만(FR-020) */
export function RentalCreatePage() {
  const navigate = useNavigate();
  const create = useCreateRental();
  const [showAll, setShowAll] = useState(false);
  const devices = useDevices(showAll ? { limit: 100 } : { status: "ACTIVE", limit: 100 });
  const list: Device[] = devices.data?.pages.flatMap((page) => page.items) ?? [];
  const [deviceId, setDeviceId] = useState("");
  const [renterRef, setRenterRef] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const picked = list.find((d) => d.deviceId === deviceId);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    create.mutate(
      { deviceId, renterRef: renterRef.trim() },
      {
        onSuccess: (rental) => navigate(`/admin/rentals/${rental.rentalId}`, { state: { serial: picked?.serial, notice: "렌탈을 만들었습니다." } }),
        onError: (e) => setError(e instanceof ApiError ? e : networkError()),
      },
    );
  }

  return (
    <section className="narrow">
      <h1>렌탈 만들기</h1>
      {error && (
        <ErrorBanner message={messageFor(error, { deviceStatus: picked?.status })}>
          {error.code === "RENTAL_OPEN_EXISTS" && <Link to="/admin/rentals?status=OPEN">진행 중인 렌탈 보기</Link>}
        </ErrorBanner>
      )}
      <form onSubmit={submit} noValidate>
        <label className="switch">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              // 사용 가능 기기만 보기로 돌아가면 목록에서 사라질 선택은 지운다
              if (!e.target.checked && picked && picked.status !== "ACTIVE") setDeviceId("");
            }}
          />
          다른 상태 기기도 보기
        </label>
        <SelectField label="기기" required value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">기기를 고르세요</option>
          {list.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.serial} · {d.modelName}
              {d.status !== "ACTIVE" ? ` (${DEVICE_STATUS_LABEL[d.status]})` : ""}
            </option>
          ))}
        </SelectField>
        {devices.hasNextPage && (
          <Button type="button" busy={devices.isFetchingNextPage} onClick={() => void devices.fetchNextPage()}>
            기기 더 불러오기
          </Button>
        )}
        <Field label="대여자 참조 번호" required maxLength={128} placeholder="이름 대신 쓰는 번호" value={renterRef} onChange={(e) => setRenterRef(e.target.value)} />
        <div className="row">
          <Link className="button-link" to="/admin/rentals">
            취소
          </Link>
          <Button type="submit" busy={create.isPending} disabled={!deviceId || !renterRef.trim()}>
            렌탈 만들기
          </Button>
        </div>
      </form>
    </section>
  );
}
