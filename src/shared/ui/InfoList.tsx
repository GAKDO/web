import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 이름 · 값 목록(dl). 기본 정보 상자와 기기 상세가 같이 쓴다 */
export function InfoList({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm", className)}>
      {items.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="m-0 min-w-0 font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
