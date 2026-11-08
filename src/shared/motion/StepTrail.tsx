import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "todo";

export interface TrailStep {
  label: string;
  state: StepState;
}

/**
 * 진행 단계 줄(11/8). 시점 목록 같은 다른 목록 안에도 들어가므로 목록(ol)이 아니라 묶음(group)으로 둔다.
 * 실제 상태(SSE 진행 단계·시점 상태·검수 상태)에서 만든 단계만 그리고,
 * 단계가 바뀌면 막대가 차오르고 점이 바뀌는 짧은 전환만 둔다. 진행률을 모르면 백분율을 만들지 않는다
 */
export function StepTrail({ steps, label, className }: { steps: TrailStep[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("m-trail grid gap-1.5", className)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s) => (
        <div key={s.label} data-state={s.state} className="m-trail-step min-w-0">
          <span aria-hidden="true" className="m-trail-bar" />
          <span className="mt-1.5 flex min-w-0 items-start gap-1 text-xs leading-tight">
            {s.state === "done" && <Check aria-hidden="true" className="mt-px size-3 shrink-0" />}
            {s.state === "current" && <span aria-hidden="true" className="m-trail-dot mt-1" />}
            <span className="min-w-0 break-keep">{s.label}</span>
            <span className="sr-only">{s.state === "done" ? " 끝남" : s.state === "current" ? " 진행 중" : " 대기"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** 순서가 있는 단계 이름 목록과 지금 단계 번호로 상태를 매긴다. current가 목록 길이 이상이면 모두 끝남 */
export function trailOf(labels: string[], current: number): TrailStep[] {
  return labels.map((label, i) => ({ label, state: i < current ? "done" : i === current ? "current" : "todo" }));
}
