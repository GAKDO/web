import type { FormEvent, ReactNode } from "react";

/** 등록·수정 화면의 입력 상자(shadcn/ui Card 모양). 브라우저 기본 검사 대신 화면이 오류 문장을 보인다 */
export function FormCard({ onSubmit, children }: { onSubmit: (event: FormEvent) => void; children: ReactNode }) {
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border bg-card p-5 shadow-xs md:p-6">
      {children}
    </form>
  );
}

/** 입력 칸 묶음(치수·사양). 768px 이상은 두 칸씩 */
export function FormGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 mb-2 grid min-w-0 gap-x-3 border-0 p-0 md:grid-cols-2">
      <legend className="mb-3 w-full border-t pt-4 text-sm font-semibold text-muted-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** 맨 아래 버튼 줄: 취소(보조)와 저장(주 동작) */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap justify-end gap-2 border-t pt-4">{children}</div>;
}
