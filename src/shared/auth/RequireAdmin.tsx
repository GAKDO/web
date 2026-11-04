import { Navigate, NavLink, Outlet } from "react-router-dom";
import { ClipboardCheck, ExternalLink, FileText, LayoutGrid, Laptop, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlashNotice } from "../ui/FlashNotice";
import { useAuth } from "./AuthProvider";
import { isArchived } from "../config/features";
import { pilotDashboardUrl } from "../config/pilotDashboard";

const MENU: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/inspections", label: "검사 결과", icon: ClipboardCheck },
  { to: "/admin/devices", label: "기기", icon: Laptop },
  { to: "/admin/models", label: "기종", icon: LayoutGrid },
  { to: "/admin/rentals", label: "렌탈", icon: FileText },
];

// 메뉴 한 칸(어두운 바탕): 375px은 위쪽 가로 메뉴, 768px 이상은 왼쪽 세로 메뉴. 지금 화면은 흰 글자 + 빨간 막대
const ITEM =
  "relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[15px] font-medium whitespace-nowrap text-sidebar-foreground no-underline transition-colors duration-200 hover:bg-white/5 hover:text-sidebar-active md:min-h-10 md:gap-2.5 md:px-3 md:text-sm";
const ACTIVE =
  "bg-white/10 text-sidebar-active hover:bg-white/10 after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand md:after:inset-x-auto md:after:inset-y-2 md:after:-left-3 md:after:h-auto md:after:w-[3px]";

/** 로고: 빨간 네모 안 T + TRACE 글자 */
function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 md:px-2 md:pb-6">
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand text-base font-black text-white shadow-[0_0_24px_-4px_var(--brand)]">
        T
      </span>
      <strong className="text-lg font-bold tracking-[0.12em] text-white">TRACE</strong>
    </span>
  );
}

/** 관리자만 들어오는 화면의 틀. 로그인하지 않았으면 로그인 화면으로 보낸다(FR-006) */
export function RequireAdmin() {
  const { status, role, logout } = useAuth();
  // 파일럿 추이(Grafana)는 MVP 배포에서 보관(VITE_ARCHIVED_FEATURES=pilot)이면 주소가 있어도 숨긴다
  const pilotUrl = isArchived("pilot") ? null : pilotDashboardUrl();
  if (status === "unknown") return <p className="p-6 text-muted-foreground">로그인 상태를 확인하는 중…</p>;
  if (status === "anonymous" || role !== "ADMIN") return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      {/* 바깥 칸은 화면 끝까지 어두운 바탕, 안쪽 메뉴는 스크롤해도 제자리(sticky) */}
      <div className="bg-sidebar md:border-r md:border-sidebar-border">
        <header className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 pt-3 md:sticky md:top-0 md:flex md:h-svh md:flex-col md:items-stretch md:gap-1 md:overflow-y-auto md:px-3 md:py-6">
          <Brand />
          <p className="col-span-full row-start-2 m-0 hidden px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase md:block">관리</p>
          <nav aria-label="관리 메뉴" className="col-span-full row-start-3 -mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
            {MENU.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn(ITEM, isActive && ACTIVE)}>
                <Icon aria-hidden="true" className="size-[18px]" />
                {label}
              </NavLink>
            ))}
            {/* 파일럿 추이는 학교 Grafana에 있어 새 탭으로 연다(FR-PIL-02) */}
            {pilotUrl && (
              <a href={pilotUrl} target="_blank" rel="noopener noreferrer" className={ITEM}>
                파일럿 추이 <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
          </nav>
          <div className="md:border-t md:border-sidebar-border md:pt-3">
            <button type="button" className={cn(ITEM, "border-0 bg-transparent")} onClick={() => logout()}>
              <LogOut aria-hidden="true" className="size-[18px]" />
              로그아웃
            </button>
          </div>
        </header>
      </div>
      <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-6 md:px-8 md:py-8 min-[1600px]:max-w-[1600px]">
        <FlashNotice />
        <Outlet />
      </main>
    </div>
  );
}
