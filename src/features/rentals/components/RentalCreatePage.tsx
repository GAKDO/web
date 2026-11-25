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
import { Field, SelectField, TextAreaField } from "../../../shared/ui/Field";
import { useDevice, useDevices } from "../../devices/api/devices";
import { useCreateRental } from "../api/rentals";
import { CUSTOMER_NAME_MAX, NOTE_MAX } from "./RentalDetailsPanel";
import { DUE_HINT, dueInputError, todayKst } from "../dueDate";

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
  // 고객 이름·반납 예정일·메모(contracts #23, 11/10). 모두 선택이라 비우면 보내지 않는다
  const [customerName, setCustomerName] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const picked = list.find((d) => d.deviceId === deviceId);
  const dueError = dueInputError(dueAt);

  function submit(event: FormEvent) {
    event.preventDefault();
    // 선택지에 보이는 기기만 제출한다(넘겨받은 기기를 아직 못 읽었거나 못 읽은 경우 막음)
    if (!picked || dueError) return;
    setError(null);
    create.mutate(
      {
        deviceId: picked.deviceId,
        renterRef: renterRef.trim(),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (rental) => navigate(`/admin/rentals/${rental.rentalId}`, { state: { serial: picked?.serial, notice: "렌탈을 만들었습니다." } }),
        onError: (e) => setError(e instanceof ApiError ? e : networkError()),
      },
    );
  }

  return (
    <section className="max-w-xl">
      <PageHeader back={{ to: "/admin/rentals", label: "렌탈 목록" }} title="렌탈 만들기" description="기기와 대여자 참조 번호로 렌탈을 만듭니다. 고객 이름·반납 예정일·메모는 나중에 렌탈 상세에서도 적을 수 있습니다." />
      {error && (
        <ErrorBanner message={messageFor(error, { deviceStatus: picked?.status })}>
          {error.code === "RENTAL_OPEN_EXISTS" && <Link to="/admin/rentals?status=OPEN">진행 중인 렌탈 보기</Link>}
        </ErrorBanner>
      )}
      {prefilled.isError && (
        <ErrorBanner message="넘겨받은 기기를 불러오지 못했습니다. 다시 시도하거나 목록에서 기기를 고르세요." onRetry={() => void prefilled.refetch()} />
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
        <Field label="대여자 참조 번호" required maxLength={128} placeholder="예: R-2026-0012" value={renterRef} onChange={(e) => setRenterRef(e.target.value)} />
        <Field label="고객 이름 (선택)" maxLength={CUSTOMER_NAME_MAX} placeholder="예: 홍길동" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Field
          label="반납 예정일 (선택)"
          type="date"
          min={todayKst()}
          hint={DUE_HINT}
          error={dueError}
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <TextAreaField
          label="메모 (선택)"
          maxLength={NOTE_MAX}
          placeholder="예: 충전기 함께 대여"
          hint="관리자에게만 보입니다."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <FormActions>
          <Link className={buttonVariants({ variant: "outline" })} to="/admin/rentals">
            취소
          </Link>
          <Button type="submit" busy={create.isPending} disabled={!picked || !renterRef.trim() || !!dueError}>
            렌탈 만들기
          </Button>
        </FormActions>
      </FormCard>
    </section>
  );
}
