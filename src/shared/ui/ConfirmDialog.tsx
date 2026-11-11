import { TriangleAlert } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 되돌리기 어려운 동작 전에 한 번 더 묻는 창(FR-011). 누른 버튼 바로 아래에 펼친다 */
export function ConfirmDialog({ message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      className="mt-3 grid gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={message}
    >
      <p className="m-0 flex items-start gap-2 font-medium text-destructive">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCancel}>취소</Button>
        <Button variant="destructive" busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
