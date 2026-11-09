import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import type { TimelineCheckpoint } from "../../../shared/api/types";
import { CHAIN_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { useDeviceModel, useTimeline } from "../api/report";
import { useProgress, type ProgressState } from "../api/progress";
import { CHECKPOINT_ORDER, hasPendingCheckpoint } from "../model/timeline";
import { ProgressBadge } from "./ProgressBadge";
import { CompareTable } from "./CompareTable";
import { TwinSection } from "./TwinSection";
import { VerifyQr } from "./VerifyQr";

/** 고객 화면 공통 폭(마이페이지와 같음). page는 3D·비교표의 옛 CSS를 이 안에서만 쓰게 한다 */
const MAIN = "page mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";
}

function CheckpointCard({ type, checkpoint, progress }: { type: TimelineCheckpoint["type"]; checkpoint: TimelineCheckpoint | undefined; progress: ProgressState }) {
  const label = CHECKPOINT_TYPE_LABEL[type];
  if (!checkpoint) {
    return (
      <li className="grid content-start gap-2 rounded-xl border border-dashed bg-card/60 p-4" aria-label={label}>
        <strong className="text-base">{label}</strong>
        <span className="text-sm text-muted-foreground">아직 진행 전</span>
      </li>
    );
  }
  const sealed = checkpoint.status === "SEALED";
  return (
    // 시점 칸은 처음 그릴 때 짧게 떠오르고, 상태가 바뀌면(검사 중 → 봉인됨) 표시만 다시 떠오른다
    <li className="grid animate-enter content-start gap-2 rounded-xl border bg-card p-4 shadow-xs" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-base">{label}</strong>
        <Badge key={checkpoint.status} variant={sealed ? "success" : "warning"} className="animate-enter">{sealed ? "봉인됨" : "검사 중"}</Badge>
      </div>
      {(checkpoint.grade || sealed) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {checkpoint.grade && <span className="font-semibold">등급 {checkpoint.grade}</span>}
          {sealed && <span className={checkpoint.newDefectCount > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>신규 흠집 {checkpoint.newDefectCount}개</span>}
        </div>
      )}
      {checkpoint.sealedAt && <small className="text-xs text-muted-foreground">봉인 {formatDateTime(checkpoint.sealedAt)}</small>}
      {!sealed && <ProgressBadge event={progress.byCheckpoint[checkpoint.checkpointId]} reconnecting={progress.reconnecting} failed={progress.failed} />}
    </li>
  );
}

/** 돌아갈 곳. 관리자는 렌탈 상세(관리자 화면)에서 들어오므로 그리로 보낸다(11/9 실서버) */
type Back = { to: string; label: string };

function backFor(isAdmin: boolean, rentalId: string): Back {
  return isAdmin ? { to: `/admin/rentals/${rentalId}`, label: "렌탈 상세" } : { to: "/my/rentals", label: "마이페이지" };
}

/** 리포트를 열지 못했을 때. 403·404는 리포트 문맥 문장으로 바꾼다(FR-004) */
function ReportError({ error, onRetry, isAdmin, back }: { error: unknown; onRetry: () => void; isAdmin: boolean; back: Back }) {
  const backLink = (
    <Link className="button-link" to={back.to}>
      {isAdmin ? "렌탈 상세로" : "내 렌탈 목록으로"}
    </Link>
  );
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div role="alert" className="notice">
        <p>이 렌탈을 볼 권한이 없습니다.</p>
        {backLink}
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div role="alert" className="notice">
        {/* 관리자에게 404는 렌탈이 없어서가 아니라 리포트 서버에 이 렌탈 기록(시점 이벤트)이 아직 없다는 뜻이다 */}
        <p>{isAdmin ? "이 렌탈의 리포트 기록이 아직 없습니다. 시점을 시작하거나 부스 검사 결과가 들어오면 생깁니다." : "렌탈을 찾을 수 없습니다."}</p>
        {backLink}
      </div>
    );
  }
  return <ErrorBanner message={error instanceof ApiError ? messageFor(error) : "리포트를 불러오지 못했습니다."} onRetry={onRetry} />;
}

/** 렌탈 리포트(FR-USR-03·RPT-03). 3D·비교표·진행률은 이 화면 안에 붙는다 */
export function ReportPage() {
  const { rentalId = "" } = useParams();
  const isAdmin = useAuth().role === "ADMIN";
  const back = backFor(isAdmin, rentalId);
  const timeline = useTimeline(rentalId);
  const model = useDeviceModel(timeline.data?.modelCode);
  const progress = useProgress(rentalId, !!timeline.data && hasPendingCheckpoint(timeline.data.checkpoints));

  if (timeline.isPending) return <main className={MAIN}><p className="text-muted-foreground">리포트를 불러오는 중…</p></main>;
  if (timeline.isError) {
    return (
      <main className={cn(MAIN, "max-w-xl")}>
        <h1 className="m-0 mb-4 text-2xl font-bold tracking-tight">렌탈 리포트</h1>
        <ReportError error={timeline.error} onRetry={() => void timeline.refetch()} isAdmin={isAdmin} back={back} />
      </main>
    );
  }
  const data = timeline.data;
  return (
    <main className={MAIN}>
      <Link
        to={back.to}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {back.label}
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="m-0 text-sm font-semibold text-brand">상태 리포트</p>
          <h1 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">{model.data?.name ?? data.modelCode}</h1>
        </div>
        {data.verifyUrl && (
          <a className={cn(buttonVariants({ variant: "outline" }), "text-foreground no-underline")} href={data.verifyUrl}>
            <ShieldCheck aria-hidden="true" />
            기록 검증하기
          </a>
        )}
      </div>
      {data.verifyUrl && <VerifyQr url={data.verifyUrl} />}
      {data.chainStatus === "BROKEN" && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
          {CHAIN_STATUS_LABEL.BROKEN}. 관리자에게 문의해 주세요.
        </p>
      )}
      <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3" aria-label="시점">
        {CHECKPOINT_ORDER.map((type) => (
          <CheckpointCard key={type} type={type} checkpoint={data.checkpoints.find((c) => c.type === type)} progress={progress} />
        ))}
      </ol>
      <TwinSection modelCode={data.modelCode} checkpoints={data.checkpoints} />
      <CompareTable checkpoints={data.checkpoints} />
    </main>
  );
}
