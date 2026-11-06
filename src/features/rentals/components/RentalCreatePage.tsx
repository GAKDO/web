import { PageHeader } from "../../../shared/ui/PageHeader";
import { FormActions, FormCard } from "../../../shared/ui/FormCard";
import { buttonVariants } from "@/components/ui/button";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Device } from "../../../shared/api/types";
import { ApiError, networkError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useDevice, useDevices } from "../../devices/api/devices";
import { useCreateRental } from "../api/rentals";

/** 기기와 대여자 참조 번호로 렌탈을 만든다. 기본은 사용 가능 기기만(FR-020) */
export function RentalCreatePage() {
  const navigate = useNavigate();
  const create = useCreateRental();
  const [showAll, setShowAll] = useState(false);
  const devices = useDevices(showAll ? { limit: 100 } : { status: "ACTIVE", limit: 100 });
  // 기기 상세의 "이 기기로 렌탈 만들기"가 넘긴 기기를 미리 고른다
  const location = useLocation();
  const prefillId = (location.state as { deviceId?: string } | null)?.deviceId ?? "";
  const [deviceId, setDeviceId] = useState(prefillId);
  // 넘겨받은 기기가 목록 첫 쪽(100대)에 없어도 선택지에 보이도록 따로 읽어 덧붙인다
  const prefilled = useDevice(prefillId);
  const loaded: Device[] = devices.data?.pages.flatMap((page) => page.items) ?? [];
  const list: Device[] =
    prefilled.data && !loaded.some((d) => d.deviceId === prefilled.data.deviceId) ? [prefilled.data, ...loaded] : loaded;
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
    <section className="max-w-xl">
      <PageHeader title="렌탈 만들기" description="기기와 대여자 참조 번호로 렌탈을 만듭니다. 기본은 사용 가능 기기만 보입니다." />
      {error && (
        <ErrorBanner message={messageFor(error, { deviceStatus: picked?.status })}>
          {error.code === "RENTAL_OPEN_EXISTS" && <Link to="/admin/rentals?status=OPEN">진행 중인 렌탈 보기</Link>}
        </ErrorBanner>
      )}
      <FormCard onSubmit={submit}>
        <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            className="size-5 accent-brand"
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
          <Button type="button" size="sm" className="mb-4" busy={devices.isFetchingNextPage} onClick={() => void devices.fetchNextPage()}>
            기기 더 불러오기
          </Button>
        )}
        <Field label="대여자 참조 번호" required maxLength={128} placeholder="이름 대신 쓰는 번호" value={renterRef} onChange={(e) => setRenterRef(e.target.value)} />
        <FormActions>
          <Link className={buttonVariants({ variant: "outline" })} to="/admin/rentals">
            취소
          </Link>
          <Button type="submit" busy={create.isPending} disabled={!deviceId || !renterRef.trim()}>
            렌탈 만들기
          </Button>
        </FormActions>
      </FormCard>
    </section>
  );
}
