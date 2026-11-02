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

/** 면 윤곽선(viewBox 100×75 안에서 가로·세로 비율을 지킨 사각형) */
function Outline({ aspect }: { aspect: number }) {
  let w = 80;
  let h = w / aspect;
  if (h > 65) [h, w] = [65, 65 * aspect];
  return (
    <svg className="outline" viewBox="0 0 100 75" aria-hidden="true">
      <rect x={(100 - w) / 2} y={(75 - h) / 2} width={w} height={h} rx="1.5" />
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

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    openCamera()
      .then((s) => {
        stream = s;
        if (!alive) return stopCamera(s);
        if (video.current) attachStream(video.current, s);
        setPhase("live");
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
      setReview({ shot, check: checkQuality(shot.gray, guide.face) });
    } catch {
      setPhase("failed");
    } finally {
      setBusy(false);
    }
  }

  const failed = phase !== "starting" && phase !== "live";
  return (
    <section className="shooter" aria-label={`${label} 찍기`}>
      <h2>{label}</h2>
      <p>{guide.guide}</p>
      {failed && <CameraHelp kind={phase} onRetry={() => setAttempt((n) => n + 1)} />}
      <div className="viewfinder" hidden={failed || review !== null}>
        <video ref={video} playsInline muted />
        <Outline aspect={guide.aspect} />
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
        {review?.check.ok && <Button onClick={() => onAccept(review)}>이 사진 쓰기</Button>}
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
        <Button
          onClick={() => {
            if (review) URL.revokeObjectURL(review.shot.previewUrl);
            onCancel();
          }}
        >
          면 목록으로
        </Button>
      </div>
    </section>
  );
}
