import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import type { PairingCodeResponse } from "../../../shared/api/types";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";

/** 진단 에이전트 페어링 코드(FR-AUTH-02, 5분). 코드는 화면 상태에만 두고 저장하거나 로그에 남기지 않는다 */
/**
 * deviceSerial: 대여 기기의 등록 시리얼(contracts auth 0.2.0 필수). 진단 서버가 업로드한 진단의 시리얼과 대조한다.
 * 모르면 코드를 만들지 않는다(서버가 400을 낸다).
 */
export function PairingCodePanel({ rentalId, checkpointId, deviceSerial }: { rentalId: string; checkpointId: string; deviceSerial?: string }) {
  const [now, setNow] = useState(() => Date.now());
  // 다시 만들기가 진행 중이거나 실패해도 아직 유효한 코드는 그대로 보인다
  const [issued, setIssued] = useState<PairingCodeResponse | undefined>(undefined);
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/pairing-codes", { body: { rentalId, checkpointId, deviceSerial: deviceSerial ?? "" } })),
    onSuccess: setIssued,
  });
  const expiresAt = issued ? new Date(issued.expiresAt).getTime() : 0;
  const expired = issued !== undefined && now >= expiresAt;

  // 남은 시간을 보이고, 5분이 지나면 코드를 가린다
  useEffect(() => {
    if (!issued) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [issued]);

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <div className="qr-panel">
      {create.isError && (
        <ErrorBanner
          message={create.error instanceof ApiError ? messageFor(create.error) : "페어링 코드를 만들지 못했습니다. 다시 시도해 주세요."}
        />
      )}
      {issued && !expired && (
        <>
          <p className="pairing-code" aria-label="페어링 코드">
            {issued.code}
          </p>
          <p>
            진단 에이전트에 이 6자리를 입력하세요. 남은 시간 {Math.floor(left / 60)}분 {left % 60}초.
          </p>
        </>
      )}
      {expired && <p role="status">페어링 코드가 만료됐습니다. 새로 만들어 주세요.</p>}
      {!deviceSerial && <p role="note">렌탈 정보에 기기 시리얼이 없어 코드를 만들 수 없습니다. 렌탈 목록에서 이 렌탈을 다시 열어 주세요.</p>}
      <Button busy={create.isPending} disabled={!deviceSerial} onClick={() => create.mutate()}>
        {issued ? "페어링 코드 다시 만들기" : "진단 페어링 코드 만들기"}
      </Button>
    </div>
  );
}
