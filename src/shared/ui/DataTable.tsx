import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  /** 열 너비(grid-template-columns). 머리 줄과 각 줄이 같은 값을 쓴다 */
  cols: string;
  /** 머리 줄 글자. 빈 글자는 버튼 칸 */
  labels: string[];
  /** 목록 이름(화면 읽기·테스트가 찾는 이름) */
  label: string;
  /** DataRow들 */
  children: ReactNode;
}

/**
 * 목록 표(11/4 목업, shadcn/ui 표 모양). 375~1099px은 카드 목록, 1100px 이상은 머리 줄 + 한 줄씩 같은 열.
 * 1100px부터인 까닭: 왼쪽 메뉴를 빼고 768px에서는 6칸이 500px에 끼어 글자가 한 자씩 줄이 바뀐다.
 * 목록(ul·li) 구조는 그대로 두어 화면 읽기는 목록으로 읽고, 머리 줄은 보이는 글자만이라 숨긴다
 */
export function DataTable({ cols, labels, label, children }: DataTableProps) {
  return (
    <div
      className="mb-4 table:overflow-hidden table:rounded-xl table:border table:bg-card table:shadow-xs"
      style={{ "--cols": cols } as CSSProperties}
    >
      <div
        className="hidden gap-3 border-b bg-muted/60 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground table:grid table:grid-cols-(--cols)"
        aria-hidden="true"
      >
        {labels.map((text, i) => (
          <span key={i}>{text}</span>
        ))}
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 table:gap-0" aria-label={label}>
        {children}
      </ul>
    </div>
  );
}

/** 표 한 줄(375px에서는 카드 한 장) */
export function DataRow({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <li
      aria-label={label}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors md:grid-cols-[1fr_auto] md:items-center",
        "table:min-h-14 table:grid-cols-(--cols) table:rounded-none table:border-0 table:border-t table:px-4 table:py-2 table:shadow-none table:first:border-t-0 table:hover:bg-muted/40",
        className,
      )}
    >
      {children}
    </li>
  );
}

/** 줄의 칸들. 카드에서는 한데 흐르고, 표에서는 칸마다 열 하나 */
export function DataCells({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 table:contents [&>*]:min-w-0 [&>*]:break-words">{children}</div>
  );
}

/** 줄 끝 버튼 칸 */
export function DataActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 table:flex-nowrap table:justify-end">{children}</div>;
}

/** 줄 아래로 펼치는 상세(기기 상세보기) */
export function DataDetail({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="col-span-full grid gap-3 rounded-lg bg-muted p-4">
      {children}
    </div>
  );
}
