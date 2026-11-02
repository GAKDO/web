import type { Pin } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";

interface Props {
  pins: Pin[];
  selected: string | null;
  onSelect(pin: Pin): void;
}

/** 3D 핀과 같은 흠집 목록. 신규는 색과 "신규" 글자로 구분한다(FR-013) */
export function PinList({ pins, selected, onSelect }: Props) {
  if (pins.length === 0) return <p>이 시점에 찾은 흠집이 없습니다.</p>;
  const ordered = [...pins].sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return (
    <ul className="pin-list" aria-label="흠집">
      {ordered.map((pin) => (
        <li key={pin.defectId}>
          <button
            type="button"
            className={`pin-button${pin.isNew ? " pin-new" : ""}`}
            aria-pressed={selected === pin.defectId}
            onClick={() => onSelect(pin)}
          >
            {pin.isNew && <strong className="pin-tag">신규</strong>}
            {CAPTURE_FACE_LABEL[pin.face]} 흠집
          </button>
        </li>
      ))}
    </ul>
  );
}
