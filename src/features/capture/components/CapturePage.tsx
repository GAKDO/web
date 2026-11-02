import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import type { CaptureFace } from "../../../shared/api/types";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { PHONE_FACES } from "../faces";
import { FaceShooter, type Accepted } from "./FaceShooter";
import { SubmitPanel } from "./SubmitPanel";

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
export function CapturePage({ grant }: { grant: CaptureGrant }) {
  const [shots, setShots] = useState<Shots>({});
  const [active, setActive] = useState<CaptureFace | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasShots = !done && Object.keys(shots).length > 0;
  useLeaveWarning(hasShots);
  useInAppLeaveConfirm(hasShots);
  const minutesLeft = useMinutesLeft(grant.expiresAt);
  const remaining = PHONE_FACES.filter((f) => f.required && !shots[f.face]).map((f) => f.face);
  const guide = PHONE_FACES.find((f) => f.face === active);
  const expired = minutesLeft <= 0;

  // 페이지를 떠날 때 남은 미리보기 URL을 한 번 해제한다
  const latest = useRef(shots);
  latest.current = shots;
  useEffect(() => () => Object.values(latest.current).forEach((a) => a && URL.revokeObjectURL(a.shot.previewUrl)), []);

  function accept(face: CaptureFace, accepted: Accepted) {
    const previous = shots[face];
    if (previous) URL.revokeObjectURL(previous.shot.previewUrl);
    const next = { ...shots, [face]: accepted };
    setShots(next);
    setActive(PHONE_FACES.find((f) => f.required && !next[f.face])?.face ?? null);
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
      <main className="page capture">
        <h1>제출 완료</h1>
        <p role="status">수령 사진이 접수되었습니다. 검사가 끝나면 내 렌탈에서 결과를 볼 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="page capture">
      <h1>수령 사진 찍기</h1>
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
          <ol className="faces">
            {PHONE_FACES.map((f) => (
              <li key={f.face}>
                <button type="button" className="face" disabled={submitting} onClick={() => setActive(f.face)}>
                  <span>
                    {CAPTURE_FACE_LABEL[f.face]}
                    {!f.required && " (선택)"}
                  </span>
                  <span>{shots[f.face] ? "✓ 찍음" : "찍기"}</span>
                </button>
              </li>
            ))}
          </ol>
          <p role="status">
            {remaining.length > 0
              ? `남은 필수 면: ${remaining.map((f) => CAPTURE_FACE_LABEL[f]).join(", ")}`
              : "필수 면을 모두 찍었습니다."}
          </p>
          <SubmitPanel
            grant={grant}
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
