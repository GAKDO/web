import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TraceLogo } from "./TraceLogo";

/**
 * 고객 화면·검증 화면 맨 위 어두운 띠. 로고를 누르면 첫 화면(/)으로 간다.
 * 오른쪽에는 그 화면에서 갈 곳(내 렌탈·내 계정 등)을 둔다
 */
export function SiteBar({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-sidebar text-white">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="TRACE 첫 화면" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <TraceLogo className="h-8" />
        </Link>
        {children && (
          <nav aria-label="고객 메뉴" className="flex items-center gap-1 text-sm">
            {children}
          </nav>
        )}
      </div>
    </header>
  );
}
