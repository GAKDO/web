import { useRef, useState } from "react";
import { ApiError } from "../../../shared/api/problem";
import type { CaptureFace } from "../../../shared/api/types";
import type { CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { PHONE_FACES } from "../faces";
import { completeSession, createSession, reissueUploads, sameShots, uploadPending, type Photo, type UploadSession } from "../submit";
import type { Shots } from "./CapturePage";

const SKIP_REASONS = ["화면이 켜지지 않음", "화면이 깨져 흰 화면을 띄울 수 없음"];
const OTHER = "직접 입력";
const GRANT_EXPIRED = "촬영 시간이 지났습니다. 대여 담당자에게 새 QR을 받아 주세요.";

interface Props {
  grant: CaptureGrant;
  shots: Shots;
  remaining: CaptureFace[];
  /** 서버가 빠졌다고 한 면(그 면 사진을 지우고 다시 찍게 함) */
  onMissing(faces: CaptureFace[]): void;
  onDone(): void;
  /** 제출 중이면 true. CapturePage가 그동안 면 버튼을 잠근다 */
  onBusyChange(busy: boolean): void;
}

/** 제출: 건너뛴 이유 → 세트 생성 → 업로드 진행률 → 완료(US4) */
export function SubmitPanel({ grant, shots, remaining, onMissing, onDone, onBusyChange }: Props) {
  const session = useRef<UploadSession | null>(null);
  // 세트 생성 응답 전에 두 번 눌러도 요청은 하나만 보낸다
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(SKIP_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos: Photo[] = PHONE_FACES.flatMap(({ face }) => (shots[face] ? [{ face, shot: shots[face].shot }] : []));
  const skipScr1 = !shots.SCR1;
  const skipReason = reason === OTHER ? otherReason.trim() : reason;
  const ready = remaining.length === 0 && (!skipScr1 || skipReason.length > 0);

  async function upload(allowRenew: boolean): Promise<boolean> {
    if (!session.current || !sameShots(session.current, photos)) session.current = await createSession(grant, photos);
    setProgress(session.current.done.filter(Boolean).length);
    const result = await uploadPending(session.current, photos, setProgress);
    if (result === "expired" && allowRenew) {
      // 같은 세트에서 URL만 다시 받는다. 다시 받기가 안 되면(세트가 사라짐 등) 새 세트를 만든다
      try {
        await reissueUploads(session.current);
      } catch {
        session.current = null;
      }
      return upload(false);
    }
    if (result !== "ok") {
      const left = session.current.done.filter((d) => !d).length;
      setError(`${left}장을 올리지 못했습니다. 연결을 확인하고 다시 시도해 주세요.`);
      return false;
    }
    return true;
  }

  async function submit() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      if (!(await upload(true)) || !session.current) return;
      await completeSession(session.current, skipScr1 ? { SCR1: skipReason } : {});
      onDone();
    } catch (e) {
      if (!(e instanceof ApiError)) return setError("제출하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
      if (e.code === "CAPTURE_SET_CLOSED") return onDone();
      if (e.status === 401 || e.status === 403) return setError(GRANT_EXPIRED);
      if (e.code === "CAPTURE_FACES_MISSING") {
        session.current = null;
        onMissing(e.missingFaces);
        return setError(`다음 면을 다시 찍어 주세요: ${e.missingFaces.map((f) => CAPTURE_FACE_LABEL[f]).join(", ")}`);
      }
      if (e.code === "CAPTURE_HASH_MISMATCH") session.current = null;
      setError(e.code === "CAPTURE_HASH_MISMATCH" ? "사진이 올바르게 올라가지 않았습니다. 다시 제출해 주세요." : "제출하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      running.current = false;
      setBusy(false);
      onBusyChange(false);
      setProgress(null);
    }
  }

  return (
    <section className="card" aria-label="제출">
      {skipScr1 && (
        <>
          <SelectField label="화면(흰색)을 찍지 않은 이유" value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)}>
            {[...SKIP_REASONS, OTHER].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectField>
          {reason === OTHER && <Field label="이유" maxLength={200} value={otherReason} disabled={busy} onChange={(e) => setOtherReason(e.target.value)} />}
        </>
      )}
      {error && <ErrorBanner message={error} />}
      {progress !== null && <p role="status">{`${progress} / ${photos.length} 올리는 중`}</p>}
      <Button busy={busy} disabled={!ready} onClick={() => void submit()}>
        {error ? "다시 시도" : "제출"}
      </Button>
    </section>
  );
}
