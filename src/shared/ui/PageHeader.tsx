import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/** 제목 위 작은 되돌아가기 링크(상세·등록 화면이 막다른 화면이 되지 않게) */
export interface BackLink {
  to: string;
  label: string;
}

/** 화면 제목 줄: (되돌아가기) 제목·설명 + 오른쪽 주 동작 버튼 */
export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: BackLink }) {
  return (
    <div className="mb-6 grid gap-2">
      {back && (
        <Link
          to={back.to}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="m-0 text-2xl font-bold tracking-tight">{title}</h1>
          {description && <div className="m-0 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
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
