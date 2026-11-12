import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FlashNotice } from "../ui/FlashNotice";
import { ADMIN_MENU, REVIEW_MENU_PATH, SiteHeader } from "../ui/SiteHeader";
import { usePendingReviewLabel } from "../../features/inspections/components/PendingReviewBadge";
import { useIsMobile } from "../ui/useMediaQuery";
import { useAuth } from "./AuthProvider";

// 폰(767px 이하) 아래 탭 한 칸: 엄지로 닿는 아래쪽에 메뉴 5개를 고르게 놓는다(가로로 밀지 않음)
const TAB =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-zinc-500 no-underline transition-[color,scale] duration-200 active:scale-95 motion-reduce:scale-none";
const TAB_ACTIVE =
  "text-foreground before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-brand";

/**
 * 관리자만 들어오는 화면의 틀. 로그인하지 않았으면 로그인 화면으로 보낸다(FR-006).
 * 11/8: 왼쪽 세로 메뉴 대신 위에 붙은 헤더(SiteHeader admin)에서 검사 결과·기기·기종·렌탈·성능·부스 화면·로그아웃으로 바로 간다.
 * 폰은 헤더 메뉴 버튼 + 아래 탭 메뉴(자주 쓰는 5개)
 */
export function RequireAdmin() {
  const { status, role } = useAuth();
  const { pathname } = useLocation();
  const mobile = useIsMobile();
  // 폰 아래 탭의 "검사 결과"에도 검수 대기 건수를 붙인다(헤더와 같은 캐시)
  const pendingReviews = usePendingReviewLabel(mobile && status === "authenticated" && role === "ADMIN");
  if (status === "unknown")
    return (
      <p className="p-6 text-muted-foreground">로그인 상태를 확인하는 중…</p>
    );
  if (status === "anonymous" || role !== "ADMIN")
    return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader variant="admin" />
      {/* 폰은 아래 탭 메뉴 높이만큼 바닥을 비워 마지막 줄이 가리지 않게 */}
      <main
        key={pathname}
        className="mx-auto w-full max-w-[75rem] min-w-0 animate-enter px-4 pt-5 pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-6 md:py-8 min-[1600px]:max-w-[100rem]"
      >
        <FlashNotice />
        <Outlet />
      </main>
      {/* 폰 아래 탭 메뉴. 넓은 화면은 헤더 메뉴만 그린다(화면 읽기가 메뉴를 두 번 읽지 않게) */}
      {mobile && (
        <nav
          aria-label="자주 쓰는 관리 메뉴"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)] backdrop-blur md:hidden"
        >
          {ADMIN_MENU.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(TAB, isActive && TAB_ACTIVE)}
            >
              {({ isActive }) => (
                <>
                  {to === REVIEW_MENU_PATH && pendingReviews && (
                    <span aria-hidden="true" className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-brand px-1 text-center text-[0.625rem] leading-4 font-semibold text-white tabular-nums">
                      {pendingReviews}
                    </span>
                  )}
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-[1.375rem] transition-transform duration-200",
                        isActive && "scale-110 text-brand",
                      )}
                    />
                  )}
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
