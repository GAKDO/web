import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import type { Rental } from "../../../shared/api/types";
import { ApiError, networkError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, TextAreaField } from "../../../shared/ui/Field";
import { FormActions } from "../../../shared/ui/FormCard";
import { InfoList } from "../../../shared/ui/InfoList";
import { useUpdateRental } from "../api/rentals";
import { dueState } from "../dueDate";

/** 고객 이름·메모 최대 길이(계약 CustomerName·RentalNote) */
export const CUSTOMER_NAME_MAX = 64;
export const NOTE_MAX = 500;

/** 빈 값은 null(비우기)로 보낸다 */
const orNull = (value: string) => (value.trim() ? value.trim() : null);

/**
 * 렌탈의 고객 이름·반납 예정일·메모(contracts #23, 11/10). 상세에서 보이고 "고치기"로 바로 바꾼다.
 * 메모는 관리자에게만 오는 값이라 고객 화면에는 이 상자가 없다
 */
export function RentalDetailsPanel({ rental }: { rental: Rental }) {
  const [editing, setEditing] = useState(false);
  const due = dueState(rental);
  if (editing) return <RentalDetailsForm rental={rental} onDone={() => setEditing(false)} />;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <InfoList
        items={[
          ["고객 이름", rental.customerName || <span className="font-normal text-muted-foreground">적지 않음</span>],
          [
            "반납 예정일",
            due ? (
              <span className={due.overdue ? "text-destructive" : undefined}>
                {due.label}
                {due.overdue ? " · 지났습니다" : ""}
              </span>
            ) : (
              <span className="font-normal text-muted-foreground">정하지 않음</span>
            ),
          ],
          ["메모", rental.note ? <span className="whitespace-pre-line">{rental.note}</span> : <span className="font-normal text-muted-foreground">없음</span>],
        ]}
      />
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
        <Pencil aria-hidden="true" />
        고치기
      </Button>
    </div>
  );
}

function RentalDetailsForm({ rental, onDone }: { rental: Rental; onDone: () => void }) {
  const update = useUpdateRental(rental.rentalId);
  const [customerName, setCustomerName] = useState(rental.customerName ?? "");
  const [dueAt, setDueAt] = useState(rental.dueAt ?? "");
  const [note, setNote] = useState(rental.note ?? "");
  const [error, setError] = useState<ApiError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    update.mutate(
      { customerName: orNull(customerName), dueAt: dueAt || null, note: orNull(note) },
      { onSuccess: onDone, onError: (e) => setError(e instanceof ApiError ? e : networkError()) },
    );
  }

  return (
    <form className="rounded-xl border bg-card p-5 shadow-xs" onSubmit={submit} aria-label="고객 정보 고치기">
      {error && <ErrorBanner message={messageFor(error)} />}
      <Field label="고객 이름" maxLength={CUSTOMER_NAME_MAX} placeholder="예: 김민서" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      <Field label="반납 예정일" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      <TextAreaField label="메모" maxLength={NOTE_MAX} hint="관리자에게만 보입니다." value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          취소
        </Button>
        <Button type="submit" busy={update.isPending}>
          저장
        </Button>
      </FormActions>
    </form>
  );
}
