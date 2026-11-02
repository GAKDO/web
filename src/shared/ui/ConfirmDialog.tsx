import { Button } from "./Button";

interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 되돌리기 어려운 동작 전에 한 번 더 묻는 창(FR-011) */
export function ConfirmDialog({ message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="confirm" role="alertdialog" aria-modal="true" aria-label={message}>
      <p>{message}</p>
      <div className="row">
        <Button onClick={onCancel}>취소</Button>
        <Button className="danger" busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
