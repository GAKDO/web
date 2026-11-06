import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import type { RentalSummary } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { TraceLogo } from "../../../shared/ui/TraceLogo";
import { formatDateTime } from "../../../shared/ui/format";
import { useDeviceModels } from "../../devices/api/devices";
import { useRentals } from "../../rentals/api/rentals";
import { VerdictBadge } from "../../inspections/components/VerdictBadge";
import { boothQueue } from "../model/boothQueue";
import { BoothDevicePanel } from "./BoothDevicePanel";

/**
 * gakdo.site/booth: 부스 옆 태블릿에서 여는 운영 화면(11/6 강사님 피드백 3번, 1단계).
 * 카메라·조명·추론은 그대로 Jetson이 하고, 이 화면은 서버에 있는 것만 보인다:
 * 검사 기다리는 기기 고르기 → 부스 코드(Jetson 화면에 넣음) → 판정·사진이 저절로 뜸.
 * 계약을 바꾸지 않으려고 관리자(ADMIN) 로그인으로 연다(BOOTH 토큰은 검사 결과를 읽을 수 없고 비밀값을 브라우저에 둘 수 없음).
 */
/** 렌탈 목록을 이어서 읽는 최대 쪽 수(부스 rentals.py MAX_PAGES와 같음) */
const MAX_PAGES = 5;

export function BoothPage() {
  const { status, role, login, logout } = useAuth();
  if (status === "unknown") return <p className="p-6 text-muted-foreground">로그인 상태를 확인하는 중…</p>;
  if (status !== "authenticated" || role !== "ADMIN") {
    return (
      <main className="mx-auto grid min-h-svh max-w-md content-center gap-6 px-4 py-10">
        <TraceLogo className="h-12" />
        <div className="grid gap-1">
          <h1 className="m-0 text-2xl font-bold">부스 화면</h1>
          <p className="m-0 text-sm text-muted-foreground">관리자 계정으로 로그인하면 이 태블릿이 부스 운영 화면이 됩니다.</p>
        </div>
        {status === "authenticated" && <p role="status" className="m-0 text-sm text-warning">관리자 계정만 부스 화면을 열 수 있습니다.</p>}
        <LoginForm onLogin={login} />
      </main>
    );
  }
  return <BoothBoard onLogout={() => void logout()} />;
}

function BoothBoard({ onLogout }: { onLogout(): void }) {
  const rentals = useRentals(undefined, { live: true });
  const models = useDeviceModels();
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  const items = rentals.data?.pages.flatMap((p) => p.items) ?? [];
  // 오래전에 만든 렌탈의 시점도 빠지지 않게 다음 쪽을 이어서 읽는다(부스 rentals.py처럼 최대 MAX_PAGES쪽)
  const pageCount = rentals.data?.pages.length ?? 0;
  // 다음 쪽 읽기가 실패하면 바로 다시 부르지 않는다(5초 주기 갱신이 오류를 지우면 그때 다시 읽음)
  // 전체 갱신 중이거나 실패한 동안에도 부르지 않는다(다음 쪽 요청이 진행 중인 갱신을 취소하지 않게)
  const { hasNextPage, isFetching, isError, isFetchNextPageError, fetchNextPage } = rentals;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError && !isFetchNextPageError && pageCount < MAX_PAGES) void fetchNextPage();
  }, [hasNextPage, isFetching, isError, isFetchNextPageError, pageCount, fetchNextPage]);
  const { waiting, judged } = boothQueue(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((r) => r.rentalId === selectedId) ?? null;
  // 폰·세로 태블릿은 고른 기기 칸이 목록 아래에 있어 눌렀을 때 그쪽으로 내린다
  const select = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 768) document.getElementById("booth-panel")?.scrollIntoView?.({ behavior: "smooth" });
  };

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-sidebar/95 px-4 backdrop-blur md:px-8">
        <span className="flex items-center gap-3">
          <TraceLogo className="h-10" />
          <strong className="text-sidebar-active">부스</strong>
        </span>
        <span className="flex items-center gap-2">
          <Link to="/admin/inspections" className="text-sm text-sidebar-foreground hover:text-white">
            관리자 화면
          </Link>
          <button
            type="button"
            aria-label="로그아웃"
            className="grid size-11 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-sidebar-foreground hover:text-white"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" className="size-5" />
          </button>
        </span>
      </header>
      <main className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-5 md:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] md:px-8 md:py-8">
        <div className="grid content-start gap-6">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-sm text-muted-foreground">5초마다 저절로 갱신됩니다.</p>
            <Button onClick={() => void rentals.refetch()}>
              <RefreshCw aria-hidden="true" />
              새로 고침
            </Button>
          </div>
          {rentals.isError && (
            <ErrorBanner
              message={rentals.error instanceof ApiError ? messageFor(rentals.error) : "기기 목록을 불러오지 못했습니다."}
              onRetry={() => void rentals.refetch()}
            />
          )}
          {rentals.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
          <DeviceList
            title="검사 기다리는 기기"
            empty="기다리는 기기가 없습니다. 관리자 화면에서 렌탈의 시점을 시작하세요."
            items={waiting}
            selectedId={selectedId}
            onSelect={select}
            modelName={modelName}
          />
          <DeviceList
            title="최근 판정"
            empty="아직 찍은 기기가 없습니다."
            items={judged}
            selectedId={selectedId}
            onSelect={select}
            modelName={modelName}
            showVerdict
          />
        </div>
        <section id="booth-panel" aria-label="고른 기기" className="min-w-0 scroll-mt-20">
          {selected ? (
            <BoothDevicePanel key={selected.rentalId} rental={selected} modelName={modelName(selected.modelCode)} />
          ) : (
            <div className="grid min-h-60 place-items-center rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              왼쪽에서 기기를 고르세요.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface ListProps {
  title: string;
  empty: string;
  items: RentalSummary[];
  selectedId: string | null;
  onSelect(id: string): void;
  modelName(code: string): string;
  showVerdict?: boolean;
}

function DeviceList({ title, empty, items, selectedId, onSelect, modelName, showVerdict }: ListProps) {
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="m-0 text-lg font-semibold">
        {title} <span className="text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 && <p className="m-0 text-sm text-muted-foreground">{empty}</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((r) => {
          const cp = r.currentCheckpoint ?? null;
          const active = r.rentalId === selectedId;
          return (
            <li key={r.rentalId}>
              <button
                type="button"
                aria-pressed={active}
                aria-label={`${r.serial} ${cp ? CHECKPOINT_TYPE_LABEL[cp.type] : ""}`}
                onClick={() => onSelect(r.rentalId)}
                className={cn(
                  "grid min-h-16 w-full cursor-pointer gap-1 rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:border-brand/60",
                  active && "border-brand ring-2 ring-brand/30",
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-base">{modelName(r.modelCode)}</strong>
                  {showVerdict ? <VerdictBadge checkpoint={cp} /> : cp && <span className="text-sm font-medium text-brand">{CHECKPOINT_TYPE_LABEL[cp.type]} 촬영</span>}
                </span>
                <span className="text-sm text-muted-foreground">
                  시리얼 {r.serial}
                  {showVerdict && cp ? ` · ${CHECKPOINT_TYPE_LABEL[cp.type]} · ${cp.occurredAt ? formatDateTime(cp.occurredAt) : "—"}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
