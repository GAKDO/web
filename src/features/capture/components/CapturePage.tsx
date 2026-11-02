import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CaptureFace } from "../../../shared/api/types";
import type { CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { PHONE_FACES } from "../faces";
import { FaceShooter, type Accepted } from "./FaceShooter";

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

interface Props {
  grant: CaptureGrant;
  /** 제출 부분(WE2-③). 찍은 사진과 남은 필수 면을 받는다 */
  renderSubmit?(shots: Shots, remaining: CaptureFace[]): ReactNode;
}

/** 면 목록 → 면 하나 찍기 → 다음 면(US3·US4-1) */
export function CapturePage({ grant, renderSubmit }: Props) {
  const [shots, setShots] = useState<Shots>({});
  const [active, setActive] = useState<CaptureFace | null>(null);
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
                <button type="button" className="face" onClick={() => setActive(f.face)}>
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
          {renderSubmit?.(shots, remaining)}
        </>
      )}
    </main>
  );
}
