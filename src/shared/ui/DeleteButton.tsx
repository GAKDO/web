import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../api/problem";
import { messageFor } from "../api/errorMessages";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteButtonProps {
  label: string;
  /** 확인 창 문장. 무엇이 함께 지워지는지 적는다 */
  confirm: string;
  busy: boolean;
  /** 지우기 요청. 실패하면 던진 오류의 문장을 버튼 아래에 보인다 */
  onDelete: () => Promise<unknown>;
  size?: "sm" | "default";
}

/**
 * 지우기 버튼(11/10 민서 요청: 시험 기종·기기·렌탈 정리). 누르면 바로 아래에 확인 창을 펼치고,
 * 이력이 있어 서버가 409로 막으면 그 이유(DEVICE_IN_USE 등)를 그대로 보인다
 */
export function DeleteButton({ label, confirm, busy, onDelete, size }: DeleteButtonProps) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (busy) return;
    setError(null);
    Promise.resolve()
      .then(onDelete)
      .then(() => setAsking(false))
      .catch((e: unknown) => {
        setAsking(false);
        setError(e instanceof ApiError ? messageFor(e) : "지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      });
  }

  return (
    <div>
      <Button size={size} className="text-destructive" disabled={busy} onClick={() => setAsking(true)}>
        <Trash2 aria-hidden="true" />
        {label}
      </Button>
      {asking && <ConfirmDialog message={confirm} confirmLabel={label} busy={busy} onConfirm={run} onCancel={() => setAsking(false)} />}
      {error && (
        <p className="mt-2 mb-0 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
