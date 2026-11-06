import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { isArchived } from "../../../shared/config/features";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Button } from "../../../shared/ui/Button";

/**
 * 내 계정 `/my/account`. 고객이 로그인한 뒤 머무는 곳(FR-USR-01·04).
 * 3D 리포트(WE3)를 숨긴 MVP 배포에서도 로그아웃·탈퇴로 갈 길을 남긴다
 */
export function MyAccountPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const reportArchived = isArchived("report");

  async function signOut() {
    const confirmed = await logout();
    // 서버가 로그아웃을 확인하지 못했으면 리프레시가 남았을 수 있으니 로그인 화면에서 알린다
    navigate(confirmed ? "/" : "/login?loggedOut=partial", { replace: true });
  }

  return (
    <main className="page narrow">
      <h1>내 계정</h1>
      <section aria-label="계정 상태" className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <p role="status" className="m-0 inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
          로그인되어 있습니다
        </p>
        <p className="m-0 mt-2 text-sm text-muted-foreground">
          {reportArchived
            ? "노트북을 빌리면 관리자가 부스에서 상태를 검사하고 결과를 기록합니다."
            : "빌린 노트북의 검사 사진과 흠집 기록은 내 렌탈에서 볼 수 있습니다."}
        </p>
        {!reportArchived && (
          <Link to="/my/rentals" className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full no-underline sm:w-auto")}>
            내 렌탈 보기
          </Link>
        )}
      </section>
      <section aria-label="계정 관리" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 md:p-6">
        <Button onClick={() => void signOut()}>로그아웃</Button>
        <Link to="/my/account/withdraw" className="text-sm text-muted-foreground">
          계정 탈퇴
        </Link>
      </section>
    </main>
  );
}
