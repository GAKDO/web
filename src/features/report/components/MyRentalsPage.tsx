import { Link } from "react-router-dom";
import { Camera, Laptop, Lock, ScanSearch, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { isArchived } from "../../../shared/config/features";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useMe } from "../../account/api";
import { useMyRentals } from "../api/report";
import { MyDeviceCard } from "./MyDeviceCard";

const FLOW = [
  { title: "출고 검사", text: "노트북을 내보내기 전에 부스에서 윗면·바닥을 찍고 흠집을 찾아 둡니다." },
  { title: "수령 확인", text: "받았을 때 상태를 한 번 더 남겨, 처음부터 있던 흠집을 구분합니다." },
  { title: "반납 비교", text: "돌려줄 때 처음 사진과 비교해 새로 생긴 흠집만 보여 줍니다." },
];

const MANAGED = [
  { icon: Camera, title: "부스 사진 12장", text: "윗면·바닥을 카메라 2대, 조명 3개로 찍어 작은 긁힘도 놓치지 않습니다." },
  { icon: ScanSearch, title: "흠집 자동 판정", text: "사진에서 긁힘·찍힘을 찾아 A~D 등급을 매기고, 사진 위에 위치를 표시합니다." },
  { icon: Lock, title: "봉인된 기록", text: "시점마다 기록을 봉인하고 지문을 메일로 보내, 업체도 나중에 고칠 수 없습니다." },
];

/** 아직 렌탈이 연결되지 않은 고객에게: 고장 난 화면처럼 보이지 않게, 무엇이 쌓일지와 다음에 할 일을 보여 준다 */
function EmptyRentals({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <section aria-labelledby="empty-rentals" className="rounded-2xl border border-dashed bg-card p-5 md:p-7">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
        <Laptop className="size-5" />
      </span>
      <h3 id="empty-rentals" className="mt-4 mb-1 text-lg font-bold">
        아직 연결된 렌탈이 없습니다
      </h3>
      <p className="m-0 text-sm text-muted-foreground">
        노트북을 빌리면 그 렌탈이 이 계정에 연결되고, 아래 세 번의 검사 결과가 여기에 차례로 쌓입니다.
      </p>
      <ol className="m-0 mt-5 grid list-none gap-3 p-0 md:grid-cols-3">
        {FLOW.map((step, i) => (
          <li key={step.title} className="rounded-xl border bg-background p-4">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <strong className="mt-2 block">{step.title}</strong>
            <span className="mt-1 block text-sm text-muted-foreground">{step.text}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-5 text-sm">
        노트북은 렌탈 창구에서 빌리고, 받을 때 직원이 보여 주는 QR을 폰으로 찍으면 이 계정에 연결됩니다.{" "}
        <Link to="/guide">이용 안내 보기</Link>
      </p>
      <p className="m-0 mt-2 text-sm">렌탈을 받은 뒤에도 비어 있으면 새로 고침을 눌러 보세요. 연결되면 바로 여기에 보입니다.</p>
      <div className="mt-3">
        <Button busy={refreshing} disabled={refreshing} onClick={onRefresh}>
          새로 고침
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 고객 마이페이지(FR-USR-03). 내 정보 요약, 숫자 요약, 내 노트북(기종 사양·단계별 등급), 관리 방식.
 * 숫자는 서버 값만 쓴다: 연결된 노트북은 /auth/me의 rentalIds, 사용 중·반납은 불러온 목록 기준(다음 쪽이 있으면 그렇게 적는다)
 */
export function MyRentalsPage() {
  const me = useMe();
  const rentals = useMyRentals();
  const items = rentals.data?.pages.flatMap((page) => page.items) ?? [];
  const partial = rentals.hasNextPage ? `불러온 ${items.length}대 기준` : undefined;
  const linked = me.data?.rentalIds.length ?? items.length;
  const name = me.data?.role === "CUSTOMER" ? me.data.name : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 rounded-2xl bg-sidebar p-5 text-white md:flex-row md:items-center md:justify-between md:p-7">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10">
            <UserRound className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-bold md:text-2xl">마이페이지</h1>
            <p className="m-0 mt-0.5 truncate text-sm text-zinc-300">
              {name ? `${name}님, 빌린 노트북의 상태 기록을 한곳에서 확인하세요.` : "빌린 노트북의 상태 기록을 한곳에서 확인하세요."}
            </p>
          </div>
        </div>
        {!isArchived("account") && (
          <Link to="/my/account" className={cn(buttonVariants({ variant: "outline" }), "border-white/20 bg-transparent text-white no-underline hover:bg-white/10 hover:text-white")}>
            내 정보 관리
          </Link>
        )}
      </header>

      <dl aria-label="요약" className="m-0 mt-4 grid grid-cols-3 gap-3">
        <Stat label="연결된 노트북" value={`${linked}대`} />
        <Stat label="사용 중" value={`${items.filter((r) => r.status === "OPEN").length}대`} hint={partial} />
        <Stat label="반납 완료" value={`${items.filter((r) => r.status !== "OPEN").length}대`} hint={partial} />
      </dl>

      <section aria-labelledby="my-devices" className="mt-10">
        <h2 id="my-devices" className="m-0 text-xl font-bold md:text-2xl">
          내 노트북
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">빌린 노트북의 사양과 출고·수령·반납 검사 결과입니다.</p>
        <div className="mt-4">
          {rentals.isPending && <p role="status">불러오는 중…</p>}
          {rentals.isError && (
            <ErrorBanner
              message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "목록을 불러오지 못했습니다."}
              onRetry={() => void (rentals.isFetchNextPageError ? rentals.fetchNextPage() : rentals.refetch())}
            />
          )}
          {rentals.isSuccess && items.length === 0 && <EmptyRentals onRefresh={() => void rentals.refetch()} refreshing={rentals.isFetching} />}
          {items.length > 0 && (
            <ul aria-label="내 노트북" className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
              {items.map((rental) => (
                <MyDeviceCard key={rental.rentalId} rental={rental} />
              ))}
            </ul>
          )}
          {rentals.hasNextPage && (
            <div className="mt-4">
              <Button busy={rentals.isFetchingNextPage} disabled={rentals.isFetching} onClick={() => void rentals.fetchNextPage()}>
                더 보기
              </Button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="managed" className="mt-12">
        <h2 id="managed" className="m-0 text-xl font-bold md:text-2xl">
          내 노트북은 이렇게 관리돼요
        </h2>
        <ul className="m-0 mt-4 grid list-none gap-3 p-0 md:grid-cols-3">
          {MANAGED.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border bg-card p-5">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 mb-1 text-base font-semibold">{title}</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-4 text-sm">
          <Link to="/guide">대여부터 반납까지 자세히 보기</Link>
        </p>
      </section>
    </main>
  );
}
