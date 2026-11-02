import type { CheckpointMedia, Inspection, Pin } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";

interface Props {
  pin: Pin;
  inspection: Inspection | undefined;
  media: CheckpointMedia | undefined;
  onClose(): void;
}

/** 핀을 누르면 보이는 흠집 상세(FR-014): 크롭·종류·면·크기 */
export function PinDetail({ pin, inspection, media, onClose }: Props) {
  const defect = inspection?.defects.find((d) => d.defectId === pin.defectId);
  const crop = media?.crops.find((c) => c.defectId === pin.defectId);
  return (
    <div className="pin-detail" role="dialog" aria-label="흠집 상세">
      {crop && <img src={crop.url} alt="흠집 확대 사진" width={120} height={120} />}
      <dl>
        <dt>종류</dt>
        <dd>{defect ? DEFECT_CLASS_LABEL[defect.class] : "확인 중"}</dd>
        <dt>위치</dt>
        <dd>{CAPTURE_FACE_LABEL[pin.face]}</dd>
        {defect?.lengthMm != null && (
          <>
            <dt>길이</dt>
            <dd>{defect.lengthMm}mm</dd>
          </>
        )}
        <dt>구분</dt>
        <dd>{pin.isNew ? "이번 시점에 새로 생김" : "이전 시점부터 있음"}</dd>
      </dl>
      <button type="button" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}
