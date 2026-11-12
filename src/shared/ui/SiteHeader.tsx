import { useEffect, useState, type CSSProperties } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  ChartColumn,
  ClipboardCheck,
  ExternalLink,
  FileText,
  LayoutGrid,
  Laptop,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth/AuthProvider";
import { isArchived } from "../config/features";
import { pilotDashboardUrl } from "../config/pilotDashboard";
import { TraceLogo } from "./TraceLogo";
import { useIsMobile } from "./useMediaQuery";

export interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** 새 탭으로 여는 바깥 화면(부스 화면·파일럿 추이) */
  external?: boolean;
  end?: boolean;
}

/** 관리자 핵심 메뉴. 폰 아래 탭 메뉴도 같은 목록을 쓴다 */
export const ADMIN_MENU: NavItem[] = [
  { to: "/admin/inspections", label: "검사 결과", icon: ClipboardCheck },
  { to: "/admin/devices", label: "기기", icon: Laptop },
  { to: "/admin/models", label: "기종", icon: LayoutGrid },
  { to: "/admin/rentals", label: "렌탈", icon: FileText },
  { to: "/admin/benchmark", label: "성능", icon: ChartColumn },
];

/** 관리자 화면에서만 보이는 바깥 화면 링크. 파일럿 추이는 보관 배포(VITE_ARCHIVED_FEATURES=pilot)면 숨긴다 */
function adminExtras(): NavItem[] {
  const pilotUrl = isArchived("pilot") ? null : pilotDashboardUrl();
  return [
    { to: "/booth", label: "부스 화면", icon: Camera, external: true },
    ...(pilotUrl ? [{ to: pilotUrl, label: "파일럿 추이", external: true }] : []),
  ];
}

/**
 * 고객·공개 화면의 메뉴. 로그인 상태와 보관 설정(report·account)에 따라 갈 수 있는 곳만 둔다.
 * 로그인했으면 고객·관리자 모두 헤더 오른쪽 위에서 로그아웃한다(11/12 민서: 고객도 내 정보 화면까지 가지 않고 로그아웃). 내 정보 화면의 로그아웃도 그대로 둔다
 */
function siteLinks(signedIn: boolean, admin: boolean): NavItem[] {
  const report = !isArchived("report");
  const account = !isArchived("account");
  // 보유 노트북은 로그인과 상관없이 누구나 본다(11/8)
  const items: NavItem[] = [{ to: "/devices", label: "보유 노트북" }];
  if (signedIn && report) items.push({ to: "/my/rentals", label: "마이페이지" });
  if (report && (signedIn || account)) items.push({ to: "/guide", label: "이용 안내" });
  if (signedIn && admin) items.push({ to: "/admin/devices", label: "관리자 화면" });
  else if (signedIn && account) items.push({ to: "/my/account", label: "내 정보", end: true });
  return items;
}

/** 스크롤을 조금이라도 내리면 true. 헤더 바탕을 더 진하게 하고 아래 선을 보인다 */
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

const LINK =
  "relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-medium whitespace-nowrap text-zinc-400 no-underline transition-colors duration-200 hover:text-white";
// 밑줄은 링크 안쪽 맨 아래(after:bottom-0)에 그린다. 링크 밖으로 내보내면 메뉴 칸(overflow-x-auto)이 넘쳐 가로·세로 스크롤바가 생긴다
const LINK_ACTIVE = "text-white after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-white";
/** 넓은 화면 메뉴의 링크. 헤더 높이를 꽉 채워 밑줄이 헤더 아래 선에 붙는다 */
const NAV_LINK = cn(LINK, "h-full rounded-none");

function HeaderLink({ item, className, activeClassName, onNavigate, style }: { item: NavItem; className: string; activeClassName?: string; onNavigate?: () => void; style?: CSSProperties }) {
  const Icon = item.icon;
  if (item.external)
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer" className={className} style={style} onClick={onNavigate}>
        {Icon && <Icon aria-hidden="true" className="size-4" />}
        {item.label}
        <ExternalLink aria-hidden="true" className="size-3.5 opacity-60" />
      </a>
    );
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(className, isActive && activeClassName)} style={style} onClick={onNavigate}>
      {Icon && <Icon aria-hidden="true" className="size-4" />}
      {item.label}
    </NavLink>
  );
}

/**
 * 모든 화면 맨 위에 붙어 있는 헤더(11/8). 스크롤해도 제자리에 있고, 내 정보·마이페이지·관리 메뉴로 바로 간다.
 * variant="admin"은 관리자 메뉴(검사 결과·기기·기종·렌탈·성능·부스 화면)를, "site"는 로그인 상태에 맞는 고객 메뉴를 보인다. 로그인했으면 둘 다 로그아웃을 둔다.
 * 폰(767px 이하)은 로고 + 메뉴 버튼만 두고, 누르면 헤더 아래로 큰 글자 메뉴가 펼쳐진다.
 * 넓은 화면 메뉴와 폰 메뉴는 둘 중 하나만 그린다(화면 읽기가 같은 메뉴를 두 번 읽지 않게)
 */
export function SiteHeader({ variant = "site" }: { variant?: "site" | "admin" }) {
  const { status, role, logout } = useAuth();
  const mobile = useIsMobile();
  const scrolled = useScrolled();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const signedIn = status === "authenticated";
  const admin = variant === "admin";
  // 관리 화면은 항상, 공개·고객 화면은 로그인했으면(고객·관리자 모두) 헤더에서 로그아웃한다
  const headerLogout = admin || signedIn;
  // 11/9 민서: 로그아웃하면 로그인 화면이 아니라 첫 화면으로 간다.
  // 먼저 첫 화면으로 옮긴 뒤 세션을 끝내, 화면 보호(RequireAdmin·RequireCustomer)가 로그인 화면으로 보내지 않게 한다
  // 서버가 로그아웃(리프레시 폐기)을 확인하지 못했으면 내 정보 화면과 같이 로그인 화면에서 알린다(새로 고침 때 세션이 되살아날 수 있음)
  const onLogout = async () => {
    setOpen(false);
    navigate("/", { replace: true });
    const confirmed = await logout();
    if (!confirmed) navigate("/login?loggedOut=partial", { replace: true });
  };
  const showAccount = !isArchived("account");

  const links = status === "unknown" ? [] : admin ? [...ADMIN_MENU, ...adminExtras()] : siteLinks(signedIn, role === "ADMIN");

  // 다른 화면으로 가면 폰 메뉴를 닫는다
  useEffect(() => setOpen(false), [pathname]);
  // 폰 메뉴가 열린 동안 뒤 화면 스크롤을 멈추고 Esc로 닫는다
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 폰에서 로그인 링크는 펼침 메뉴 안에만 있으므로, 다른 메뉴가 없어도(report 보관 배포) 메뉴 버튼을 보인다
  const guestLogin = status === "anonymous" && !admin && showAccount;
  // 로그인 전 고객 입구. 고객 계정을 숨긴 배포는 관리자 로그인이 입구다
  const guestActions =
    status !== "anonymous" || admin ? null : showAccount ? (
      <>
        {!mobile && (
          <Link to="/login" className={LINK}>
            로그인
          </Link>
        )}
        <Link to="/signup" className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-full px-4 text-[0.9375rem]")}>
          회원가입
        </Link>
      </>
    ) : (
      <Link to="/admin/login" className={LINK}>
        관리자 로그인
      </Link>
    );

  return (
    <header
      data-scrolled={scrolled || open}
      className="site-header sticky top-0 z-40 text-white"
    >
      <div className="mx-auto flex h-14 w-full max-w-[75rem] items-center gap-3 px-4 md:px-6 min-[1600px]:max-w-[100rem]">
        <Link to="/" aria-label="TRACE 첫 화면" className="shrink-0 rounded-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <TraceLogo className="h-8" />
        </Link>
        {!mobile && links.length > 0 && (
          <nav aria-label={admin ? "관리 메뉴" : "고객 메뉴"} className="ml-4 flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map((item) => (
              <HeaderLink key={item.to} item={item} className={NAV_LINK} activeClassName={LINK_ACTIVE} />
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1">
          {guestActions}
          {headerLogout && !mobile && (
            <button type="button" className={cn(LINK, "cursor-pointer border-0 bg-transparent")} onClick={() => void onLogout()}>
              <LogOut aria-hidden="true" className="size-4" />
              로그아웃
            </button>
          )}
          {mobile && (links.length > 0 || headerLogout || guestLogin) && (
            <button
              type="button"
              aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={open}
              aria-controls="site-menu"
              className="grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-zinc-300 transition-colors hover:text-white"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
          )}
        </div>
      </div>
      {mobile && open && (
        <nav
          id="site-menu"
          aria-label={admin ? "관리 메뉴" : "고객 메뉴"}
          className="site-menu animate-fade absolute inset-x-0 top-full h-[calc(100svh-3.5rem)] overflow-y-auto px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
        >
          <ul className="m-0 list-none p-0">
            {links.map((item, i) => (
              <li key={item.to} className="border-b border-white/10">
                <HeaderLink
                  item={item}
                  className="stagger flex animate-enter items-center gap-3 py-4 text-[1.375rem] font-semibold tracking-[-0.02em] text-zinc-200 no-underline"
                  activeClassName="text-white"
                  style={{ "--i": i } as CSSProperties}
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
          {!signedIn && status === "anonymous" && showAccount && !admin && (
            <Link to="/login" className="mt-6 inline-block text-base font-medium text-zinc-400 no-underline">
              이미 계정이 있어요. 로그인
            </Link>
          )}
          {headerLogout && (
            <button
              type="button"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-base font-medium text-zinc-400"
              onClick={() => void onLogout()}
            >
              <LogOut aria-hidden="true" className="size-4" />
              로그아웃
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
