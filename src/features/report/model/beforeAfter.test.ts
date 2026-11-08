import { describe, expect, it } from "vitest";
import type { Defect, Inspection, TimelineCheckpoint } from "../../../shared/api/types";
import { beforeAfter, boundsOf, previousOf } from "./beforeAfter";

function cp(type: TimelineCheckpoint["type"], status: TimelineCheckpoint["status"] = "SEALED", extra: Partial<TimelineCheckpoint> = {}): TimelineCheckpoint {
  return { checkpointId: `${type}-id`, type, status, occurredAt: null, grade: "A", newDefectCount: 0, pins: [], diagnosticsSummary: null, sealedAt: null, ...extra };
}

function defect(id: string, face: Defect["face"], match: Defect["match"], review?: Defect["review"]): Defect {
  return {
    defectId: id,
    face,
    class: "scratch",
    polygon: [[10, 10], [40, 10], [40, 20], [10, 20]],
    lengthMm: null,
    areaMm2: null,
    confidence: 0.9,
    modelVersion: "v",
    source: "AUTO",
    match,
    review,
  };
}

function inspection(defects: Defect[]): Inspection {
  return { checkpointId: "x", grade: "B", ruleVersion: "grade-rules-v1", reasons: [], defects };
}

const textures = { textures: [{ face: "TOP" as const, url: "top.jpg" }, { face: "BOT" as const, url: "bot.jpg" }] };

describe("전후 비교 모델", () => {
  it("새 흠집만 new로, 앞 시점부터 있던 흠집은 existing으로, 앞 사진에는 새 흠집과 같은 자리를 spot으로 둔다", () => {
    const result = beforeAfter({
      current: cp("RET"),
      previous: cp("OUT"),
      currentInspection: inspection([
        defect("old", "BOT", { status: "EXISTING", prevDefectId: "p-old", distanceMm: 0.5 }),
        defect("new", "TOP", { status: "NEW", prevDefectId: null, distanceMm: null }),
      ]),
      previousInspection: inspection([defect("p-old", "BOT", null)]),
      currentMedia: textures,
      previousMedia: textures,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.newCount).toBe(1);
    // 새 흠집이 있는 면을 먼저 보인다
    expect(result.faces.map((f) => f.face)).toEqual(["TOP", "BOT"]);
    expect(result.faces[0].after.map((m) => m.kind)).toEqual(["new"]);
    expect(result.faces[0].before.map((m) => m.kind)).toEqual(["spot"]);
    expect(result.faces[1].after.map((m) => m.kind)).toEqual(["existing"]);
    expect(result.faces[1].before.map((m) => m.kind)).toEqual(["existing"]);
  });

  it("앞 시점과 비교하지 않은 빠른 검사(compared=false)는 새 흠집을 만들지 않고 이유만 돌려준다", () => {
    const result = beforeAfter({
      current: cp("RET", "SEALED", { compared: false }),
      previous: cp("OUT"),
      currentInspection: inspection([defect("a", "TOP", null)]),
      previousInspection: inspection([]),
      currentMedia: textures,
      previousMedia: textures,
    });
    expect(result.status).toBe("unavailable");
  });

  it("match가 없는 흠집은 신규로 강조하지 않고, 기각한 후보는 그리지 않는다", () => {
    const result = beforeAfter({
      current: cp("RCV"),
      previous: cp("OUT"),
      currentInspection: inspection([
        defect("a", "TOP", null),
        defect("b", "TOP", { status: "NEW", prevDefectId: null, distanceMm: null }, { status: "DISMISSED", reason: "DUST", reviewedBy: null, reviewedAt: null }),
      ]),
      previousInspection: inspection([]),
      currentMedia: textures,
      previousMedia: textures,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.newCount).toBe(0);
    expect(result.faces[0].after).toEqual([expect.objectContaining({ id: "a", kind: "existing" })]);
  });

  it("출고는 기준 시점이라, 같은 면 사진이 없으면 사진이 없어 비교하지 않는다", () => {
    const base = { previous: cp("OUT"), currentInspection: inspection([defect("a", "TOP", null)]), previousInspection: inspection([]), currentMedia: textures };
    expect(beforeAfter({ ...base, current: cp("OUT"), previousMedia: textures }).status).toBe("unavailable");
    expect(beforeAfter({ ...base, current: cp("RCV"), previousMedia: { textures: [] } })).toEqual({
      status: "unavailable",
      reason: "두 시점의 같은 면 사진이 없어 나란히 비교할 수 없습니다.",
    });
  });

  it("직전 시점이 봉인 전이면 그 앞 시점으로 건너뛰지 않는다", () => {
    const ordered = [cp("OUT"), cp("RCV", "CAPTURED"), cp("RET")];
    expect(previousOf(ordered, ordered[2])).toBeNull();
    expect(previousOf(ordered, ordered[1])?.type).toBe("OUT");
  });

  it("폴리곤을 감싸는 사각형을 구한다", () => {
    expect(boundsOf([[3, 9], [7, 1], [5, 5]])).toEqual({ minX: 3, minY: 1, maxX: 7, maxY: 9 });
  });
});
