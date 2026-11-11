import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import type { Inspection } from "../../../shared/api/types";
import { failedFaces, photoOnlyDefects } from "../model/photos";

/**
 * 일부 면 판정 불가 경고(11/9 민서 요청). 정합에 실패했거나 품질이 모자란 면은 AI가 흠집을 봤어도 등급에 들어가지 않으므로
 * "문제 없음"만 보고 넘어가지 않게 판정보다 먼저, 눈에 띄게 알린다. 건너뛴 선택 면(SCR1 등)은 알리지 않는다
 */
export function UnjudgeableNotice({ inspection, compact = false }: { inspection: Inspection | null | undefined; compact?: boolean }) {
  const faces = failedFaces(inspection);
  if (faces.length === 0) return null;
  const ignored = photoOnlyDefects(inspection).filter((d) => d.review?.status !== "DISMISSED").length;
  return (
    <div role="alert" className="rounded-xl border-2 border-warning/60 bg-warning-soft p-4 text-warning">
      <p className="m-0 text-lg font-bold">⚠ 일부 면 판정 불가 · {faces.length}면</p>
      <p className="mt-1 mb-0 text-sm text-foreground">
        아래 면은 사진을 표준 좌표로 맞추지 못했거나 품질이 모자라 등급에 들어가지 않았습니다. 등급은 나머지 면만 보고 매긴 것이니, 이 면은 사진을 직접 확인하거나 다시 찍어 주세요.
        {ignored > 0 && ` AI가 이 면들에서 본 후보 ${ignored}개는 사진 위에 표시만 하고 등급에는 넣지 않았습니다.`}
      </p>
      {!compact && (
        <ul className="mt-2 mb-0 grid gap-0.5 pl-5 text-sm text-foreground">
          {faces.map((f) => (
            <li key={f.face}>
              <b>{CAPTURE_FACE_LABEL[f.face]}</b> · {f.reason}
            </li>
          ))}
        </ul>
      )}
      {compact && <p className="mt-1 mb-0 text-sm font-semibold text-foreground">{faces.map((f) => CAPTURE_FACE_LABEL[f.face]).join(" · ")}</p>}
    </div>
  );
}
