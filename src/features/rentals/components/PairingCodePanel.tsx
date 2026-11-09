import { useMutation } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { api, BASE, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import type { PairingCodeResponse } from "../../../shared/api/types";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";

/** 설치 스크립트가 TRACE_API_URL이 없을 때 쓰는 기본 API 주소(agent install/agent.sh·agent.ps1) */
const AGENT_DEFAULT_API = "https://gakdo.site";

/**
 * 노트북에 붙여 넣을 한 줄 설치·실행 명령(agent #8). 스크립트는 지금 연 화면의 origin에서 받는다
 * (/agent.sh·/agent.ps1은 web nginx, 개발은 vite 프록시가 GitHub 원본으로 넘긴다).
 * 스크립트는 진단을 기본 https://gakdo.site로 올리므로, 코드를 발급한 API 서버(apiBase)가 그 주소가 아니면
 * TRACE_API_URL로 그 서버를 알려 준다. 윈도우는 실패해도 같은 PowerShell 창에 값이 남지 않게 finally에서 지운다.
 * gakdo.site에서는 B가 정한 명령 그대로다
 */
export function agentCommands(origin: string, code: string, apiBase: string = origin): { mac: string; windows: string } {
  const run = {
    mac: `curl -fsSL ${origin}/agent.sh | sh -s ${code}`,
    windows: `& ([scriptblock]::Create((irm ${origin}/agent.ps1))) ${code}`,
  };
  if (apiBase === AGENT_DEFAULT_API) return run;
  return {
    mac: `curl -fsSL ${origin}/agent.sh | TRACE_API_URL=${apiBase} sh -s ${code}`,
    windows: `try { $env:TRACE_API_URL='${apiBase}'; ${run.windows} } finally { Remove-Item Env:TRACE_API_URL -ErrorAction SilentlyContinue }`,
  };
}

/** 명령 하나 복사. 복사가 실제로 된 때만 "복사됨"을 보인다(권한 거부·클립보드 없는 브라우저) */
function CommandCopyButton({ name, command }: { name: string; command: string }) {
  const [state, setState] = useState<"idle" | "ok" | "failed">("idle");
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(command);
      setState("ok");
    } catch {
      setState("failed");
    }
  }
  return (
    <>
      <Button size="sm" aria-label={`${name} 명령 복사`} title={command} onClick={() => void copy()}>
        {state === "ok" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {state === "ok" ? `${name} 복사됨` : `${name} 명령 복사`}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === "ok" ? `${name} 명령을 복사했습니다` : ""}
      </span>
      {state === "failed" && (
        <small role="alert" className="basis-full">
          복사하지 못했습니다. 아래 명령을 길게 눌러 직접 복사하세요: <code className="break-all select-all">{command}</code>
        </small>
      )}
    </>
  );
}

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
  const commands = issued ? agentCommands(window.location.origin, issued.code, BASE) : undefined;
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
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="진단 에이전트 설치 명령">
            <CommandCopyButton key={`mac:${issued.code}`} name="맥" command={commands?.mac ?? ""} />
            <CommandCopyButton key={`win:${issued.code}`} name="윈도우 PowerShell" command={commands?.windows ?? ""} />
          </div>
          <p className="text-sm text-muted-foreground">노트북 터미널(윈도우는 관리자 PowerShell)에 붙여 넣으세요. 결과를 보여 준 뒤 y를 눌러야 올라가요.</p>
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
