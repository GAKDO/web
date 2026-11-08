import { Fragment } from "react";
import { LockKeyhole, LockKeyholeOpen, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayback } from "./usePlayback";

export type SealState = "checking" | "valid" | "invalid";

export interface SealSlot {
  /** 시점 이름(출고·수령·반납) */
  name: string;
  /** 서버가 이 시점의 봉인 기록을 돌려줬는지. checking 중에는 아직 모름(undefined) */
  present?: boolean;
}

const RESULT: Record<SealState, string> = {
  checking: "봉인 기록을 서버와 대조하는 중",
  valid: "봉인된 뒤 바뀐 기록이 없습니다",
  invalid: "봉인된 뒤 바뀐 기록이 있습니다",
};

/**
 * ④ 기록 검증 — 봉인 확인(11/8). 시점 기록 연결 → 잠금 표시 → 검증 결과 순서로 나타난다.
 * 성공·실패 표시는 서버 검증 결과(valid)가 온 뒤에만 그리고, 그전에는 "대조하는 중"으로 둔다.
 * 기록 지문은 아래 시점 목록이 실제 값(payloadHash)으로 보이므로 여기에는 넣지 않는다.
 * 결과 문장은 화면 읽기용 판정(VerifyResult)이 따로 있어 이 그림은 화면 읽기에서 숨긴다
 */
export function SealSequence({ state, slots, className }: { state: SealState; slots: SealSlot[]; className?: string }) {
  const play = usePlayback<HTMLDivElement>();
  const LockIcon = state === "invalid" ? LockKeyholeOpen : LockKeyhole;
  const ResultIcon = state === "invalid" ? ShieldAlert : ShieldCheck;
  return (
    <div ref={play.ref} {...play.attrs} data-state={state} aria-hidden="true" className={cn("m-scene m-seal m-tone-dark grid justify-items-center gap-5 rounded-2xl px-4 py-7 md:py-9", className)}>
      <div className="flex w-full max-w-md items-center justify-center">
        {slots.map((slot, i) => (
          <Fragment key={slot.name}>
            {i > 0 && <span className="m-seal-link" style={{ animationDelay: `${0.25 + i * 0.35}s` }} />}
            <span
              className="m-seal-chip"
              data-present={slot.present === undefined ? undefined : String(slot.present)}
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              {slot.name}
              <small>{slot.present === undefined ? "확인 중" : slot.present ? "봉인 기록" : "기록 없음"}</small>
            </span>
          </Fragment>
        ))}
      </div>
      {/* 결과가 오면 key가 바뀌어 잠금 도장이 다시 찍힌다 */}
      <span key={state} className="m-seal-lock">
        <LockIcon className="size-6" />
      </span>
      <p key={`r-${state}`} className="m-seal-result m-0 inline-flex items-center gap-2 text-sm font-semibold">
        {state !== "checking" && <ResultIcon className="size-4" />}
        {RESULT[state]}
      </p>
    </div>
  );
}
