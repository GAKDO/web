import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Rental } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";

/** 한 줄: 이름 · 21자 ID · 복사. 복사가 실제로 된 때만 "복사됨"을 보인다(권한 거부·클립보드 없는 브라우저) */
function IdRow({ name, value, hint }: { name: string; value: string; hint: string }) {
  const [state, setState] = useState<"idle" | "ok" | "failed">("idle");
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setState("ok");
    } catch {
      setState("failed");
    }
  }
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm break-all select-all">{value}</code>
        <Button size="sm" aria-label={`${name} 복사`} onClick={() => void copy()}>
          {state === "ok" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {state === "ok" ? "복사됨" : "복사"}
        </Button>
        {state === "failed" && <small role="alert">복사하지 못했습니다. 글자를 길게 눌러 직접 복사하세요.</small>}
        <small className="basis-full text-muted-foreground">{hint}</small>
      </dd>
    </div>
  );
}

/**
 * 부스 '출고' 탭에 손으로 넣는 세 ID(기기·렌탈·시점). 부스 화면이 "렌탈 상세의 '부스에 넣을 ID'"라고 안내하므로 이름을 바꾸지 않는다.
 * 보통은 부스 '빠른 검사' 목록에서 기기를 누르면 자동으로 채워진다.
 */
export function BoothIdsPanel({ rental }: { rental: Rental }) {
  const started = rental.checkpoints;
  return (
    <section aria-label="부스에 넣을 ID" className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="mt-0 mb-3 text-sm text-muted-foreground">
        부스 <b>빠른 검사</b> 목록에서 이 기기를 누르면 아래 ID가 자동으로 채워집니다. 부스의 <b>출고</b> 탭에 직접 넣을 때만 복사해 쓰세요.
      </p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <IdRow name="기기 ID" value={rental.deviceId} hint="시리얼 번호가 아니라 서버가 붙인 21자 ID입니다." />
        <IdRow name="렌탈 ID" value={rental.rentalId} hint="이 화면 주소 /admin/rentals/ 뒤의 21자와 같습니다." />
        {started.map((c) => (
          <IdRow
            key={c.checkpointId}
            name={`${CHECKPOINT_TYPE_LABEL[c.type]} 시점 ID`}
            value={c.checkpointId}
            hint={`${CHECKPOINT_TYPE_LABEL[c.type]} 시작을 누르면 생깁니다.`}
          />
        ))}
      </dl>
      {started.length === 0 && (
        <p role="status" className="mt-3 mb-0 text-sm text-muted-foreground">
          시점 ID는 아래 '시점 진행'에서 출고 시작을 누르면 생깁니다.
        </p>
      )}
    </section>
  );
}
