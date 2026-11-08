import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayback } from "./usePlayback";

export interface ChainRecord {
  /** 시점 이름(출고·수령·반납) */
  name: string;
  icon: LucideIcon;
  /** 한 줄 요약(부스 촬영·내 폰으로 촬영·처음 사진과 비교) */
  tag: string;
  /** 카드 아래 자세한 내용 */
  body?: ReactNode;
}

/**
 * ② 가이드 — 세 번의 기록(11/8). 출고 → 수령 → 반납 카드가 차례로 나타나고 빨간 선으로 이어진 뒤, 카드마다 "봉인" 표시가 붙는다.
 * 구역이 화면에 들어오면 한 번만 재생하고(약 2.4초), 끝난 뒤에는 모든 내용이 그대로 읽힌다.
 * 넓은 화면은 가로로, 폰은 세로로 잇는다
 */
export function RecordChain({ records, className, label = "세 시점" }: { records: ChainRecord[]; className?: string; label?: string }) {
  const play = usePlayback<HTMLOListElement>();
  return (
    <ol ref={play.ref} {...play.attrs} aria-label={label} className={cn("m-scene m-chain m-0 grid list-none gap-y-10 p-0 md:grid-cols-3 md:gap-x-12", className)}>
      {records.map(({ name, icon: Icon, tag, body }, i) => (
        <li key={name} className="m-chain-item relative" style={{ "--i": i } as CSSProperties}>
          {i > 0 && <span aria-hidden="true" className="m-chain-link" />}
          <div className="m-chain-card h-full rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
                <Icon className="size-5" />
              </span>
              <span aria-hidden="true" className="text-sm font-semibold text-muted-foreground tabular-nums">
                0{i + 1}
              </span>
            </div>
            <h3 className="mt-5 mb-1 text-title font-bold">{name}</h3>
            <p className="m-0 text-[0.9375rem] font-medium text-foreground/80">{tag}</p>
            {body && <div className="mt-4">{body}</div>}
            <p className="m-chain-seal m-0 mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
              <LockKeyhole aria-hidden="true" className="size-3.5" />
              {name} 기록 봉인
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
