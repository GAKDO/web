import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { Link, useBlocker } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CaptureFace } from "../../../shared/api/types";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { useFaceGuides } from "../api/model";
import { FaceShooter, type Accepted } from "./FaceShooter";
import { SubmitPanel } from "./SubmitPanel";
import { isArchived } from "../../../shared/config/features";
import { useOnline } from "../../../shared/ui/useOnline";

export type Shots = Partial<Record<CaptureFace, Accepted>>;

/** 남은 촬영 시간(분, 올림). 15초마다 다시 계산 */
function useMinutesLeft(expiresAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return Math.ceil((expiresAt - now) / 60_000);
}

/** 찍은 사진이 있는 동안 페이지를 떠나려 하면 브라우저가 묻게 한다(FR-007a) */
function useLeaveWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/** 찍은 사진이 있는 동안 앱 안에서 다른 화면으로 가려 하면(뒤로 가기 등) 한 번 묻는다 */
function useInAppLeaveConfirm(active: boolean): void {
  const blocker = useBlocker(active);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("찍은 사진이 사라집니다. 이 화면을 떠날까요?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}

/** 면 목록 → 면 하나 찍기 → 다음 면(US3·US4-1) */
export function CapturePage({ grant, linked = false }: { grant: CaptureGrant; linked?: boolean }) {
  const [shots, setShots] = useState<Shots>({});
  const [active, setActive] = useState<CaptureFace | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasShots = !done && Object.keys(shots).length > 0;
  useLeaveWarning(hasShots);
  useInAppLeaveConfirm(hasShots);
  const minutesLeft = useMinutesLeft(grant.expiresAt);
  const { faces, loading: facesLoading, device } = useFaceGuides(grant.rentalId);
  const remaining = faces.filter((f) => f.required && !shots[f.face]).map((f) => f.face);
  const requiredCount = faces.filter((f) => f.required).length;
  const guide = faces.find((f) => f.face === active);
  const expired = minutesLeft <= 0;
  const online = useOnline();

  // 페이지를 떠날 때 남은 미리보기 URL을 한 번 해제한다
  const latest = useRef(shots);
  latest.current = shots;
  useEffect(() => () => Object.values(latest.current).forEach((a) => a && URL.revokeObjectURL(a.shot.previewUrl)), []);

  function accept(face: CaptureFace, accepted: Accepted) {
    const previous = shots[face];
    if (previous) URL.revokeObjectURL(previous.shot.previewUrl);
    const next = { ...shots, [face]: accepted };
    setShots(next);
    setActive(faces.find((f) => f.required && !next[f.face])?.face ?? null);
  }

  function forget(faces: CaptureFace[]) {
    faces.forEach((f) => {
      const gone = shots[f];
      if (gone) URL.revokeObjectURL(gone.shot.previewUrl);
    });
    setShots((prev) => Object.fromEntries(Object.entries(prev).filter(([f]) => !faces.includes(f as CaptureFace))));
  }

  if (done) {
    return (
      <main className="page capture grid justify-items-start gap-3">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-6" />
        </span>
        <h1 className="m-0">제출 완료</h1>
        <p role="status" className="m-0 text-muted-foreground">
          수령 사진이 접수되었습니다.{isArchived("report") ? "" : " 검사가 끝나면 내 렌탈에서 결과를 볼 수 있습니다."}
        </p>
        {!isArchived("report") && (
          <Link className={cn(buttonVariants(), "no-underline")} to="/my/rentals">
            마이페이지로 가기
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="page capture">
      <h1>수령 사진 찍기</h1>
      {/* 수령 QR 하나로 계정 연결까지 끝난다(11/8). 고객이 따로 연결할 일이 없다는 걸 알린다 */}
      {linked && (
        <p role="status" className="m-0 mb-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          이 렌탈이 내 계정에 연결되었습니다{isArchived("report") ? "." : ". 내 렌탈에서 출고 기록도 볼 수 있습니다."}
        </p>
      )}
      {!online && (
        <p role="alert" className="sticky top-2 z-10 m-0 mb-3 animate-enter rounded-lg shadow-sm border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-semibold">
          인터넷 연결이 끊겼습니다. 찍은 사진은 이 화면에 그대로 있으니 촬영 시간({minutesLeft}분 남음) 안에 연결되면 이어서 제출해 주세요. 시간이 지나면 새 QR이 필요합니다.
        </p>
      )}
      <p className="notice">촬영이 끝날 때까지 새로 고치거나 창을 닫지 마세요. 찍은 사진이 사라지고 QR을 다시 받아야 합니다.</p>
      {expired ? (
        <p role="alert">촬영 시간이 지났습니다. 대여 담당자에게 새 QR을 받아 주세요.</p>
      ) : (
        minutesLeft <= 5 && <p role="alert">촬영 시간이 {minutesLeft}분 남았습니다. 서둘러 제출해 주세요.</p>
      )}
      {expired ? null : guide ? (
        <FaceShooter key={guide.face} guide={guide} onAccept={(a) => accept(guide.face, a)} onCancel={() => setActive(null)} />
      ) : (
        <>
          {facesLoading && <p role="status">기종 치수를 불러오는 중입니다. 잠시만 기다려 주세요.</p>}
          {requiredCount > 0 && (
            <div className="mt-4 mb-2 grid gap-1.5">
              <p className="m-0 flex justify-between text-sm">
                <span className="font-semibold">아래 면을 하나씩 눌러 안내대로 찍어 주세요</span>
                <span className="text-muted-foreground tabular-nums">
                  {requiredCount - remaining.length} / {requiredCount}
                </span>
              </p>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${((requiredCount - remaining.length) / requiredCount) * 100}%` }} />
              </span>
            </div>
          )}
          <ol className="faces">
            {faces.map((f) => (
              <li key={f.face}>
                <button
                  type="button"
                  className={cn("face", shots[f.face] && "border-success/40! bg-success-soft!")}
                  disabled={submitting || facesLoading}
                  onClick={() => setActive(f.face)}
                >
                  <span>
                    {CAPTURE_FACE_LABEL[f.face]}
                    {!f.required && " (선택)"}
                  </span>
                  <span className={shots[f.face] ? "font-semibold text-success" : "font-semibold text-brand"}>{shots[f.face] ? "✓ 찍음" : "찍기"}</span>
                </button>
              </li>
            ))}
          </ol>
          <p role="status" className="my-3 text-sm text-muted-foreground">
            {remaining.length > 0
              ? `남은 필수 면: ${remaining.map((f) => CAPTURE_FACE_LABEL[f]).join(", ")}`
              : "필수 면을 모두 찍었습니다."}
          </p>
          <SubmitPanel
            grant={grant}
            device={device}
            shots={shots}
            remaining={remaining}
            onMissing={forget}
            onBusyChange={setSubmitting}
            onDone={() => {
              captureTokenStore.clear();
              setDone(true);
            }}
          />
        </>
      )}
    </main>
  );
}
