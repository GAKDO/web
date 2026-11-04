import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import type { BoothCodeResponse, Checkpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";

/**
 * 부스 6자리 코드(contracts issueBoothCode, 10분·한 번). 부스 '출고' 탭에 넣으면 세 ID가 자동으로 채워진다.
 * 코드는 화면 상태에만 두고 저장하거나 로그에 남기지 않는다. 시점이 찍히면(OPEN이 아니면) 부모가 이 칸을 내린다.
 */
export function BoothCodePanel({ rentalId, checkpoint }: { rentalId: string; checkpoint: Checkpoint }) {
  const [now, setNow] = useState(() => Date.now());
  const [issued, setIssued] = useState<BoothCodeResponse | undefined>(undefined);
  const issue = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/rentals/{rentalId}/booth-code", { params: { path: { rentalId } } })),
    onSuccess: setIssued,
  });
  const expiresAt = issued ? new Date(issued.expiresAt).getTime() : 0;
  const expired = issued !== undefined && now >= expiresAt;

  useEffect(() => {
    if (!issued) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [issued]);

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const label = CHECKPOINT_TYPE_LABEL[checkpoint.type];
  // 서버 문장(detail)이 더 구체적이면 그것을 보인다(예: "출고 시점을 먼저 시작하세요.")
  const error = issue.error instanceof ApiError ? (issue.error.detail ?? messageFor(issue.error)) : "부스 코드를 만들지 못했습니다. 다시 시도해 주세요.";
  return (
    <div role="group" className="mb-4 grid gap-2 rounded-lg border border-dashed p-4" aria-label="부스 코드">
      <p className="m-0 text-sm">
        <b>가장 쉬운 방법:</b> 코드를 발급해 부스 <b>출고</b> 탭의 &lsquo;부스 코드&rsquo; 칸에 6자리를 넣으면 아래 세 ID가 자동으로 채워집니다.
      </p>
      {issue.isError && <ErrorBanner message={error} />}
      {issued && !expired && (
        <>
          <p className="pairing-code" aria-label="부스 코드 6자리">
            {issued.code}
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            {label} 촬영용 · 한 번만 쓸 수 있어요 · 남은 시간 {Math.floor(left / 60)}분 {left % 60}초
          </p>
        </>
      )}
      {expired && <p className="m-0 text-sm">부스 코드가 만료됐습니다. 새로 발급하세요.</p>}
      <div>
        <Button busy={issue.isPending} onClick={() => issue.mutate()}>
          {issued ? "부스 코드 다시 발급" : "부스 코드 발급"}
        </Button>
        {issued && !expired && <small className="ml-2 text-muted-foreground">다시 발급하면 지금 코드는 못 씁니다.</small>}
      </div>
    </div>
  );
}
