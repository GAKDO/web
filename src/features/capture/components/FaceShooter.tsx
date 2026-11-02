import { useEffect, useRef, useState } from "react";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { attachStream, CameraError, captureShot, openCamera, stopCamera, type CameraFailure, type Shot } from "../camera";
import type { FaceGuide } from "../faces";
import { checkQuality, type QualityReason, type QualityResult } from "../quality";
import { CameraHelp } from "./CameraHelp";

export interface Accepted {
  shot: Shot;
  check: QualityResult;
}

const REASON: Record<QualityReason, string> = {
  BLUR: "사진이 흔들렸습니다. 폰을 고정하고 다시 찍어 주세요.",
  GLARE: "빛이 반사됩니다. 각도를 바꿔 다시 찍어 주세요.",
};

/** 면 윤곽선(viewBox 100×75 안에서 가로·세로 비율을 지킨 사각형)과 위쪽·왼쪽 방향 표시.
 * 옆면은 아주 얇아(약 27:1) 선이 겹치지 않게 높이를 3 이상으로 둔다 */
function Outline({ guide }: { guide: FaceGuide }) {
  let w = 80;
  let h = w / guide.aspect;
  if (h > 60) [h, w] = [60, 60 * guide.aspect];
  h = Math.max(h, 3);
  const x = (100 - w) / 2;
  const y = (75 - h) / 2;
  return (
    <svg className="outline" viewBox="0 0 100 75" aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} rx="1.5" />
      <text x="50" y={y - 2} textAnchor="middle">
        ▲ {guide.top}
      </text>
      <text x={x - 2} y={37.5} textAnchor="middle" transform={`rotate(-90 ${x - 2} 37.5)`}>
        ◀ {guide.left}
      </text>
    </svg>
  );
}

interface Props {
  guide: FaceGuide;
  onAccept(accepted: Accepted): void;
  onCancel(): void;
}

/** 면 하나 찍기: 카메라 + 윤곽선 → 찍기 → 흔들림·반사 검사 → 쓰기 또는 다시 찍기(US3) */
export function FaceShooter({ guide, onAccept, onCancel }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"starting" | "live" | CameraFailure>("starting");
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState<Accepted | null>(null);
  const [busy, setBusy] = useState(false);
  const label = CAPTURE_FACE_LABEL[guide.face];

  // 쓰지 않은 사진의 미리보기 URL은 이 화면을 떠날 때 해제한다(쓴 사진은 CapturePage가 맡는다)
  // 찍는 중에 화면을 떠나면 늦게 만들어진 URL도 바로 해제한다
  const mounted = useRef(false);
  const unaccepted = useRef<Accepted | null>(null);
  unaccepted.current = review;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (unaccepted.current) URL.revokeObjectURL(unaccepted.current.shot.previewUrl);
    };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    openCamera()
      .then((s) => {
        stream = s;
        if (!alive) return stopCamera(s);
        // 영상 크기를 알기 전에 찍으면 빈 사진이 되므로, 첫 프레임 정보가 온 뒤에 찍기 버튼을 보인다
        return video.current ? attachStream(video.current, s) : undefined;
      })
      .then(() => {
        if (alive && stream) setPhase("live");
      })
      .catch((e) => alive && setPhase(e instanceof CameraError ? e.kind : "failed"));
    return () => {
      alive = false;
      stopCamera(stream);
    };
  }, [attempt]);

  async function take() {
    if (!video.current) return;
    setBusy(true);
    try {
      const shot = await captureShot(video.current);
      if (!mounted.current) {
        URL.revokeObjectURL(shot.previewUrl);
        return;
      }
      setReview({ shot, check: checkQuality(shot.gray, guide.face) });
    } catch {
      setPhase("failed");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const failed = phase !== "starting" && phase !== "live";
  return (
    <section className="shooter" aria-label={`${label} 찍기`}>
      <h2>{label}</h2>
      <p>{guide.guide}</p>
      <p>
        화면 위쪽: {guide.top} · 왼쪽: {guide.left}
      </p>
      {failed && <CameraHelp kind={phase} onRetry={() => setAttempt((n) => n + 1)} />}
      <div className="viewfinder" hidden={failed || review !== null}>
        <video ref={video} playsInline muted />
        <Outline guide={guide} />
      </div>
      {review && (
        <div className="review">
          <img src={review.shot.previewUrl} alt={`찍은 사진: ${label}`} />
          <p role="status">{review.check.ok ? "선명하게 찍혔습니다." : REASON[review.check.reason ?? "BLUR"]}</p>
          <small>
            흔들림 점수 {review.check.blurScore} · 반사 비율 {review.check.glareRatio}
          </small>
        </div>
      )}
      <div className="row">
        {review?.check.ok && (
          <Button
            onClick={() => {
              unaccepted.current = null;
              onAccept(review);
            }}
          >
            이 사진 쓰기
          </Button>
        )}
        {review && (
          <Button
            onClick={() => {
              URL.revokeObjectURL(review.shot.previewUrl);
              setReview(null);
            }}
          >
            다시 찍기
          </Button>
        )}
        {!review && phase === "live" && (
          <Button busy={busy} onClick={() => void take()}>
            찍기
          </Button>
        )}
        <Button onClick={onCancel}>면 목록으로</Button>
      </div>
    </section>
  );
}
