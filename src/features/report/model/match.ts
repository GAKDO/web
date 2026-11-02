import type { CheckpointType, Defect, Pin } from "../../../shared/api/types";

// 흠집이 직전 시점과 어떻게 이어지는지(CA2). 비교 대상은 같은 렌탈의 바로 앞 시점(수령↔출고, 반납↔수령)이고,
// 출고는 기준 시점이라 짝을 만들지 않는다. 판정은 capture-server의 defect_match만 따르고 화면에서 다시 계산하지 않는다

/** 핀 상세의 "직전 시점과 비교" 문장 */
export function matchText(type: CheckpointType, defect: Defect | undefined, pin: Pin): string {
  if (type === "OUT") return "출고는 기준 시점이라 비교하지 않음";
  const match = defect?.match;
  if (!match) return pin.isNew ? "직전 시점에 없던 흠집" : "직전 시점부터 있던 흠집";
  if (match.status === "NEW") return "직전 시점에 없던 흠집";
  return match.distanceMm != null ? `직전 시점부터 있던 흠집 (위치 차이 ${match.distanceMm.toFixed(1)}mm)` : "직전 시점부터 있던 흠집";
}
