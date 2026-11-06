import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  ExternalLink,
  FileText,
  LayoutGrid,
  Laptop,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlashNotice } from "../ui/FlashNotice";
import { useIsMobile } from "../ui/useMediaQuery";
import { TraceLogo } from "../ui/TraceLogo";
import { useAuth } from "./AuthProvider";
import { isArchived } from "../config/features";
import { pilotDashboardUrl } from "../config/pilotDashboard";

const MENU: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/inspections", label: "검사 결과", icon: ClipboardCheck },
  { to: "/admin/devices", label: "기기", icon: Laptop },
  { to: "/admin/models", label: "기종", icon: LayoutGrid },
  { to: "/admin/rentals", label: "렌탈", icon: FileText },
];

// 왼쪽 메뉴 한 칸(768px 이상, 어두운 바탕): 지금 화면은 흰 글자 + 왼쪽 빨간 막대
const ITEM =
  "relative inline-flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-sidebar-foreground no-underline transition-colors duration-200 hover:bg-white/5 hover:text-sidebar-active";
const ACTIVE =
  "bg-white/10 text-sidebar-active hover:bg-white/10 after:absolute after:inset-y-2 after:-left-3 after:w-[3px] after:rounded-full after:bg-brand";
// 폰(767px 이하) 아래 탭 한 칸: 엄지로 닿는 아래쪽에 메뉴 4개를 고르게 놓는다(가로로 밀지 않음)
const TAB =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-zinc-500 no-underline transition-[color,scale] duration-200 active:scale-95 motion-reduce:scale-none";
const TAB_ACTIVE =
  "text-foreground before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-brand";

/** 로고: TRACE 글자 로고. 누르면 다른 화면처럼 첫 화면(/)으로 */
function Brand() {
  return (
    <Link
      to="/"
      aria-label="TRACE 첫 화면"
      className="inline-flex items-center rounded-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
    >
      <TraceLogo className="h-11" />
    </Link>
  );
}

/** 관리자만 들어오는 화면의 틀. 로그인하지 않았으면 로그인 화면으로 보낸다(FR-006) */
export function RequireAdmin() {
  const { status, role, logout } = useAuth();
  const { pathname } = useLocation();
  const mobile = useIsMobile();
  // 파일럿 추이(Grafana)는 MVP 배포에서 보관(VITE_ARCHIVED_FEATURES=pilot)이면 주소가 있어도 숨긴다
  const pilotUrl = isArchived("pilot") ? null : pilotDashboardUrl();
  if (status === "unknown")
    return (
      <p className="p-6 text-muted-foreground">로그인 상태를 확인하는 중…</p>
    );
  if (status === "anonymous" || role !== "ADMIN")
    return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      {/* 폰: 위는 로고·로그아웃만 있는 얇은 줄(스크롤해도 제자리) */}
      {mobile && (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar/95 px-4 backdrop-blur md:hidden">
          <Brand />
          <button
            type="button"
            aria-label="로그아웃"
            className="grid size-11 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-sidebar-foreground transition-colors hover:text-white active:scale-95"
            onClick={() => logout()}
          >
            <LogOut aria-hidden="true" className="size-5" />
          </button>
        </header>
      )}
      {/* 768px 이상: 왼쪽 세로 메뉴. 바깥 칸은 화면 끝까지 어두운 바탕, 안쪽 메뉴는 스크롤해도 제자리 */}
      {!mobile && (
        <div className="hidden bg-sidebar md:block md:border-r md:border-sidebar-border">
          <div className="sticky top-0 flex h-svh flex-col gap-1 overflow-y-auto px-3 py-6">
            <span className="px-2 pb-6">
              <Brand />
            </span>
            <p className="m-0 px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
              관리
            </p>
            <nav aria-label="관리 메뉴" className="flex flex-1 flex-col gap-1">
              {MENU.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(ITEM, isActive && ACTIVE)}
                >
                  <Icon aria-hidden="true" className="size-[1.125rem]" />
                  {label}
                </NavLink>
              ))}
              {/* 파일럿 추이는 학교 Grafana에 있어 새 탭으로 연다(FR-PIL-02) */}
              {pilotUrl && (
                <a
                  href={pilotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ITEM}
                >
                  파일럿 추이{" "}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              )}
            </nav>
            <div className="border-t border-sidebar-border pt-3">
              <button
                type="button"
                className={cn(ITEM, "w-full border-0 bg-transparent")}
                onClick={() => logout()}
              >
                <LogOut aria-hidden="true" className="size-[1.125rem]" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 폰은 아래 탭 메뉴 높이만큼 바닥을 비워 마지막 줄이 가리지 않게 */}
      <main
        key={pathname}
        className="mx-auto w-full max-w-[75rem] min-w-0 animate-enter px-4 pt-5 pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-8 md:py-8 min-[1600px]:max-w-[100rem]"
      >
        <FlashNotice />
        <Outlet />
      </main>
      {/* 폰 아래 탭 메뉴. 넓은 화면 메뉴와 둘 중 하나만 그린다(화면 읽기가 메뉴를 두 번 읽지 않게) */}
      {mobile && (
        <nav
          aria-label="관리 메뉴"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)] backdrop-blur md:hidden"
        >
          {MENU.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(TAB, isActive && TAB_ACTIVE)}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-[1.375rem] transition-transform duration-200",
                      isActive && "scale-110 text-brand",
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
