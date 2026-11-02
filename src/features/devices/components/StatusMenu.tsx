import { useState } from "react";
import type { Device, DeviceStatus } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { useUpdateDevice } from "../api/devices";

interface Move {
  to: DeviceStatus;
  label: string;
  /** 확인 창 문장. 없으면 바로 바꾼다 */
  confirm?: string;
}

const RETIRE: Move = { to: "RETIRED", label: "폐기", confirm: "이 기기를 폐기할까요? 폐기한 기기는 렌탈에 쓸 수 없습니다." };

// 화면에서 고를 수 있는 길(data-model.md). 폐기 → 사용 가능은 없다(11/02 결정)
export const MOVES: Record<DeviceStatus, Move[]> = {
  ACTIVE: [{ to: "MAINTENANCE", label: "수리 중으로" }, RETIRE],
  MAINTENANCE: [{ to: "ACTIVE", label: "사용 가능으로" }, RETIRE],
  RETIRED: [{ to: "MAINTENANCE", label: "수리 중으로 되돌리기", confirm: "폐기를 취소하고 수리 중으로 되돌릴까요?" }],
};

export function StatusMenu({ device }: { device: Device }) {
  const update = useUpdateDevice();
  const [asking, setAsking] = useState<Move | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(move: Move) {
    setError(null);
    update.mutate(
      { deviceId: device.deviceId, body: { status: move.to } },
      {
        onSuccess: () => setAsking(null),
        onError: (e) => {
          setAsking(null);
          setError(e instanceof ApiError ? messageFor(e) : "상태를 바꾸지 못했습니다.");
        },
      },
    );
  }

  return (
    <div className="status-menu">
      <div className="row">
        {MOVES[device.status].map((move) => (
          <Button
            key={move.to}
            busy={update.isPending && update.variables?.body.status === move.to}
            disabled={update.isPending}
            onClick={() => (move.confirm ? setAsking(move) : apply(move))}
          >
            {move.label}
          </Button>
        ))}
      </div>
      {asking?.confirm && (
        <ConfirmDialog
          message={asking.confirm}
          confirmLabel={asking.label}
          busy={update.isPending}
          onConfirm={() => apply(asking)}
          onCancel={() => setAsking(null)}
        />
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
