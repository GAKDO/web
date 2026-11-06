import { Link, useNavigate } from "react-router-dom";
import { KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { isArchived } from "../../../shared/config/features";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Button } from "../../../shared/ui/Button";
import { useMe } from "../api";

const STATUS_LABEL = { PENDING: "이메일 인증 전", ACTIVE: "사용 중", WITHDRAWN: "탈퇴함" } as const;

/**
 * 내 정보 `/my/account`(FR-USR-01·04·06). 이름·이메일·계정 상태는 GET /auth/me 값 그대로.
 * 비밀번호 바꾸기는 재설정 화면(메일 코드)으로, 탈퇴는 맨 아래 위험 구역에 둔다.
 * 3D 리포트(WE3)를 숨긴 배포에서는 고객이 머무는 곳이라 로그아웃·탈퇴로 갈 길을 남긴다
 */
export function MyAccountPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const me = useMe();
  const reportArchived = isArchived("report");

  async function signOut() {
    const confirmed = await logout();
    // 서버가 로그아웃을 확인하지 못했으면 리프레시가 남았을 수 있으니 로그인 화면에서 알린다
    navigate(confirmed ? "/" : "/login?loggedOut=partial", { replace: true });
  }

  const rows = [
    { icon: UserRound, label: "이름", value: me.data?.name },
    { icon: Mail, label: "이메일", value: me.data?.email },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <h1 className="m-0 text-2xl font-bold">내 정보</h1>
      <p role="status" className="m-0 mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="size-2 rounded-full bg-success" />
        로그인되어 있습니다{me.data ? ` · ${STATUS_LABEL[me.data.status]}` : ""}
      </p>

      <section aria-labelledby="profile" className="mt-6 rounded-2xl border bg-card p-5 shadow-xs md:p-6">
        <h2 id="profile" className="m-0 text-base font-semibold">
          계정
        </h2>
        {me.isError && <p className="m-0 mt-3 text-sm text-destructive">내 정보를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>}
        <dl className="m-0 mt-3 divide-y">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 py-3">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <dt className="w-16 shrink-0 text-sm text-muted-foreground">{label}</dt>
              <dd className="m-0 min-w-0 truncate text-sm font-medium">{value ?? (me.isPending ? "불러오는 중…" : "-")}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {!reportArchived && (
            <Link to="/my/rentals" className={cn(buttonVariants(), "no-underline")}>
              마이페이지
            </Link>
          )}
          <Link to="/password/reset" className={cn(buttonVariants({ variant: "outline" }), "no-underline")}>
            <KeyRound aria-hidden="true" />
            비밀번호 바꾸기
          </Link>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            로그아웃
          </Button>
        </div>
      </section>

      <section aria-labelledby="danger" className="mt-6 rounded-2xl border border-destructive/30 bg-destructive-soft p-5 md:p-6">
        <h2 id="danger" className="m-0 text-base font-semibold text-destructive">
          계정 탈퇴
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">탈퇴하면 이메일·이름이 지워지고, 렌탈 검사 기록은 이름 없이 남습니다.</p>
        <Link to="/my/account/withdraw" className="mt-3 inline-block text-sm font-semibold text-destructive">
          계정 탈퇴
        </Link>
      </section>
    </main>
  );
}
