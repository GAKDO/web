import type { CheckpointMedia, CheckpointType, Inspection, Pin } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";
import { matchText } from "../model/match";

interface Props {
  pin: Pin;
  /** 지금 보고 있는 시점. 출고는 비교 대상이 없다 */
  checkpointType: CheckpointType;
  inspection: Inspection | undefined;
  /** 검사 결과를 불러오지 못함(확인 중과 구분) */
  inspectionError?: boolean;
  onRetry?(): void;
  media: CheckpointMedia | undefined;
  onClose(): void;
}

/** 핀을 누르면 보이는 흠집 상세(FR-014): 크롭·종류·면·크기, 직전 시점과 비교 */
export function PinDetail({ pin, checkpointType, inspection, inspectionError = false, onRetry, media, onClose }: Props) {
  const defect = inspection?.defects.find((d) => d.defectId === pin.defectId);
  const crop = media?.crops.find((c) => c.defectId === pin.defectId);
  return (
    <div className="pin-detail animate-enter" role="dialog" aria-label="흠집 상세">
      {crop && <img src={crop.url} alt="흠집 확대 사진" width={120} height={120} />}
      <dl>
        <dt>종류</dt>
        <dd>{defect ? DEFECT_CLASS_LABEL[defect.class] : inspectionError ? "검사 결과를 불러오지 못했습니다" : "확인 중"}</dd>
        <dt>위치</dt>
        <dd>{CAPTURE_FACE_LABEL[pin.face]}</dd>
        {defect?.lengthMm != null && (
          <>
            <dt>길이</dt>
            <dd>{defect.lengthMm}mm</dd>
          </>
        )}
        {defect?.areaMm2 != null && (
          <>
            <dt>면적</dt>
            <dd>{defect.areaMm2}mm²</dd>
          </>
        )}
        <dt>직전 시점과 비교</dt>
        <dd>{matchText(checkpointType, defect, pin)}</dd>
      </dl>
      {inspectionError && !defect && onRetry && (
        <button type="button" onClick={onRetry}>
          검사 결과 다시 불러오기
        </button>
      )}
      <button type="button" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}
