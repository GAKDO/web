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
  // 한 면에 흠집이 여럿이면 면마다 1, 2…로 이름을 구별한다
  const perFace = new Map<string, number>();
  for (const pin of ordered) perFace.set(pin.face, (perFace.get(pin.face) ?? 0) + 1);
  const seen = new Map<string, number>();
  const names = ordered.map((pin) => {
    const n = (seen.get(pin.face) ?? 0) + 1;
    seen.set(pin.face, n);
    return `${CAPTURE_FACE_LABEL[pin.face]} 흠집${(perFace.get(pin.face) ?? 0) > 1 ? ` ${n}` : ""}`;
  });
  return (
    <ul className="pin-list" aria-label="흠집">
      {ordered.map((pin, i) => (
        <li key={pin.defectId}>
          <button
            type="button"
            className={`pin-button${pin.isNew ? " pin-new" : ""}`}
            aria-pressed={selected === pin.defectId}
            onClick={() => onSelect(pin)}
          >
            {pin.isNew && <strong className="pin-tag">신규</strong>}
            {names[i]}
          </button>
        </li>
      ))}
    </ul>
  );
}
