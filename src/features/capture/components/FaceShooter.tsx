import { useEffect, useRef, useState, type RefObject } from "react";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { attachStream, CameraError, captureShot, openCamera, sampleFrame, stopCamera, type CameraFailure, type Shot } from "../camera";
import type { FaceGuide } from "../faces";
import { checkQuality, liveHint, type Gray, type LiveHint, type QualityReason, type QualityResult } from "../quality";
import { CameraHelp } from "./CameraHelp";

export interface Accepted {
  shot: Shot;
  check: QualityResult;
}

const REASON: Record<QualityReason, string> = {
  DARK: "사진이 너무 어둡습니다. 불을 켜거나 밝은 곳으로 옮겨 다시 찍어 주세요.",
  BLUR: "사진이 흔들렸습니다. 폰을 고정하고 다시 찍어 주세요.",
  GLARE: "빛이 반사됩니다. 각도를 바꿔 다시 찍어 주세요.",
};

/** 찍기 전 안내 문장. OK일 때만 초록 */
const HINT: Record<LiveHint, string> = {
  DARK: "어두워요. 불을 켜거나 밝은 곳으로 옮겨 주세요",
  GLARE: "빛이 반사돼요. 폰 각도를 조금 바꿔 주세요",
  MOVING: "폰을 잠깐 멈춰 주세요",
  OK: "좋아요, 그대로 찍으세요",
};

/** 미리보기 프레임을 읽는 간격(ms). 작은 64px 프레임이라 폰에서도 가볍다 */
export const LIVE_HINT_MS = 600;

/**
 * 찍기 전 실시간 안내(11/11, 4팀의 구도·밝기 말 안내에서 아이디어). 영상이 보이는 동안만 읽고, 자동으로 찍지는 않는다.
 * 같은 안내가 이어지면 다시 그리지 않아 화면 읽기 프로그램이 같은 말을 반복하지 않는다
 */
function useLiveHint(video: RefObject<HTMLVideoElement>, face: FaceGuide["face"], active: boolean): LiveHint | null {
  const [hint, setHint] = useState<LiveHint | null>(null);
  useEffect(() => {
    if (!active) {
      setHint(null);
      return;
    }
    let prev: Gray | null = null;
    const id = setInterval(() => {
      const el = video.current;
      const frame = el ? sampleFrame(el) : null;
      if (!frame) return;
      setHint(liveHint(frame, prev, face));
      prev = frame;
    }, LIVE_HINT_MS);
    return () => clearInterval(id);
  }, [video, face, active]);
  return hint;
}

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
      {/* 왼쪽 표시는 글자를 반시계로 90° 돌려 ▲가 왼쪽을 가리키게 한다 */}
      <text x={x - 2} y={37.5} textAnchor="middle" transform={`rotate(-90 ${x - 2} 37.5)`}>
        ▲ {guide.left}
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
  const hint = useLiveHint(video, guide.face, phase === "live" && review === null);

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
      <p className="m-0 font-semibold">{guide.guide}</p>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">
        흰 점선 테두리에 노트북이 꽉 차게 맞추세요(▲ 위쪽: {guide.top} · ◀ 왼쪽: {guide.left})
      </p>
      {failed && <CameraHelp kind={phase} onRetry={() => setAttempt((n) => n + 1)} />}
      <div className="viewfinder" hidden={failed || review !== null}>
        <video ref={video} playsInline muted />
        <Outline guide={guide} />
        {hint && (
          <p
            role="status"
            className={
              "absolute inset-x-3 bottom-3 m-0 rounded-full px-3 py-1.5 text-center text-sm font-semibold shadow-sm transition-colors duration-200 " +
              (hint === "OK" ? "bg-success text-white" : "bg-white/95 text-foreground")
            }
          >
            {HINT[hint]}
          </p>
        )}
      </div>
      {review && (
        <div className="review">
          <img src={review.shot.previewUrl} alt={`찍은 사진: ${label}`} />
          <p role="status" className={review.check.ok ? "mt-2 mb-0 font-semibold text-success" : "mt-2 mb-0 font-semibold text-destructive"}>
            {review.check.ok ? "선명하게 찍혔습니다." : REASON[review.check.reason ?? "BLUR"]}
          </p>
          <small className="text-xs text-muted-foreground">
            흔들림 점수 {review.check.blurScore} · 반사 비율 {review.check.glareRatio}
          </small>
        </div>
      )}
      <div className="row mt-3">
        {review?.check.ok && (
          <Button
            variant="default"
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
          <Button variant="default" className="min-w-28" busy={busy} onClick={() => void take()}>
            찍기
          </Button>
        )}
        <Button onClick={onCancel}>면 목록으로</Button>
      </div>
    </section>
  );
}
