// 이 파일이 확인하는 것: 파일럿(보관된 기능)의 Grafana 대시보드 설정 파일(grafana/pilot-trend.dashboard.json)이
// 규칙대로 짜였는지. 배터리 건강도·사이클·벤치마크 추이를 그리는 화면이며, 화면을 띄우지 않고 설정 내용만 읽어 검사한다.

// grafana/pilot-trend.dashboard.json이 FR-PIL-02와 trace-pilot 쓰기 규칙(specs/003 data-model.md)에 맞는지 본다
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Panel {
  type: string;
  title: string;
  targets: { query: string }[];
  fieldConfig: {
    defaults: { custom?: { showPoints: string } };
    overrides: { matcher: { options: string }; properties: { id: string }[] }[];
  };
}
interface Dashboard {
  __inputs?: unknown;
  uid: string;
  time: { from: string; to: string };
  timezone: string;
  panels: (Panel & { datasource: { uid: string } })[];
  templating: { list: { name: string; multi: boolean; datasource: { uid: string } }[] };
}

// 테스트 도구: 대시보드 설정 파일을 읽고, 모든 패널의 데이터 조회문(쿼리)을 모아 둔다.
const dashboard = JSON.parse(
  readFileSync(resolve(__dirname, "../../../grafana/pilot-trend.dashboard.json"), "utf8"),
) as Dashboard;
const queries = dashboard.panels.flatMap((p) => p.targets.map((t) => t.query));

// [상황] 모든 패널의 조회문을 본다.
// [기대] 조회문이 하나 이상 있고, 모두 파일럿 전용 저장소(trace-pilot)만 읽는다.
test("대시보드는 trace-pilot 버킷만 읽는다(NFR-04)", () => {
  expect(queries.length).toBeGreaterThan(0);
  for (const q of queries) {
    expect([...q.matchAll(/bucket: "([^"]+)"/g)].map((m) => m[1])).toEqual(["trace-pilot"]);
  }
});

// [상황] 패널 제목들을 본다.
// [기대] 배터리 건강도·배터리 사이클·벤치마크가 모두 한 화면에 있다.
test("배터리 건강도·사이클·벤치마크 패널이 한 화면에 있다", () => {
  const titles = dashboard.panels.map((p) => p.title).join(" | ");
  expect(titles).toContain("배터리 건강도");
  expect(titles).toContain("배터리 사이클");
  expect(titles).toContain("벤치마크");
});

// [상황] 시간 추이 그래프 패널들을 본다.
// [기대] 3개이고, 모두 점을 항상 그린다(측정이 한 번뿐이면 선이 안 생겨 빈 그래프처럼 보이므로).
test("측정이 한 번뿐이어도 점이 보이도록 모든 패널이 점을 그린다", () => {
  const series = dashboard.panels.filter((p) => p.type === "timeseries");
  expect(series).toHaveLength(3);
  for (const p of series) expect(p.fieldConfig.defaults.custom?.showPoints).toBe("always");
});

// [상황] 화면 위 기기 고르기 칸과 조회문을 본다.
// [기대] 기기 번호(deviceId)로 고르고, 별칭(alias) 값은 조회에 쓰지 않는다(계약 규칙).
test("기기는 deviceId로 고르고 alias 태그를 쓰지 않는다(contracts diagnostics/influx.md)", () => {
  expect(dashboard.templating.list.map((v) => v.name)).toContain("deviceId");
  for (const q of queries) expect(q).not.toMatch(/alias/);
});

// [상황] 기기 별칭표 패널의 표시 설정을 본다.
// [기대] 기기 번호 칸에 값 바꿔 보이기(매핑)를 걸어 별칭을 붙인다.
test("별칭은 기기 별칭표의 deviceId 값 매핑으로 붙인다", () => {
  const table = dashboard.panels.find((p) => p.type === "table");
  const override = table?.fieldConfig.overrides.find((o) => o.matcher.options === "deviceId");
  expect(override?.properties.map((x) => x.id)).toContain("mappings");
});

// [상황] 대시보드 설정 전체 글자를 본다.
// [기대] email·실명 같은 개인정보 칸이 없다.
test("실명·이메일 칸은 없다(FR-PIL-01)", () => {
  const text = JSON.stringify(dashboard);
  expect(text).not.toMatch(/email|realName|실명/i);
});

// [상황] 대시보드 고유 번호(uid)를 본다.
// [기대] trace-pilot-trend로 고정돼 있어 다른 화면의 링크가 깨지지 않는다.
test("주소 링크와 맞도록 uid가 고정돼 있다", () => {
  expect(dashboard.uid).toBe("trace-pilot-trend");
});

// [상황] 기기 고르기 칸 설정을 본다.
// [기대] 여러 대를 함께 고를 수 있다(기기끼리 비교용).
test("기기는 여러 대 고를 수 있다(FR-003)", () => {
  expect(dashboard.templating.list.find((v) => v.name === "deviceId")?.multi).toBe(true);
});

// [상황] 기본 기간과 시간대를 본다.
// [기대] 최근 30일, 한국 시간(Asia/Seoul)이다.
test("기본 기간은 최근 30일, 시간대는 Asia/Seoul이다(FR-005)", () => {
  expect(dashboard.time).toEqual({ from: "now-30d", to: "now" });
  expect(dashboard.timezone).toBe("Asia/Seoul");
});

// [상황] 모든 패널과 고르기 칸의 데이터 출처, 설정 전체 글자를 본다.
// [기대] 서버 설정이 만드는 출처(trace-pilot)만 쓰고, 토큰·비밀번호 같은 비밀 글자가 파일에 없다.
test("데이터 소스는 provisioning이 만드는 uid trace-pilot만 쓰고 토큰을 담지 않는다(FR-006)", () => {
  expect(dashboard.__inputs).toBeUndefined();
  for (const p of dashboard.panels) expect(p.datasource.uid).toBe("trace-pilot");
  for (const v of dashboard.templating.list) expect(v.datasource.uid).toBe("trace-pilot");
  expect(JSON.stringify(dashboard)).not.toMatch(/token|password|secret/i);
});

// [상황] 모든 조회문을 본다.
// [기대] 시간순으로 정렬한다(그래프 선이 뒤엉키지 않게).
test("모든 쿼리는 시간순으로 정렬한다", () => {
  for (const q of queries) expect(q).toContain('sort(columns: ["_time"])');
});

// [상황] 기기 별칭표 패널의 조회문을 본다.
// [기대] 묶기 전에 필요한 칸(기기 번호·시각)만 남겨 종류가 다른 값이 섞여 오류 나는 일을 막고, 마지막 측정은 가장 늦은 시각으로 고른다.
test("기기 별칭표는 타입이 다른 값을 묶기 전에 버리고 마지막 측정은 최댓값으로 고른다", () => {
  const q = dashboard.panels.find((p) => p.type === "table")?.targets[0].query ?? "";
  expect(q.indexOf('keep(columns: ["deviceId", "_time"])')).toBeGreaterThan(-1);
  expect(q.indexOf("keep(")).toBeLessThan(q.indexOf("group("));
  expect(q).toContain('max(column: "_time")');
});
