import type { ReactNode } from "react";

/** 화면 제목 줄: 제목·설명 + 오른쪽 주 동작 버튼 */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="grid min-w-0 gap-1">
        <h1 className="m-0 text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** 화면 안 작은 제목(h2) */
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-8 mb-3 text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}
