// grafana/pilot-trend.dashboard.json이 FR-PIL-02와 trace-pilot 쓰기 규칙(specs/002 data-model.md)에 맞는지 본다
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Panel {
  title: string;
  targets: { query: string }[];
  fieldConfig: { defaults: { custom: { showPoints: string } } };
}
interface Dashboard {
  __inputs: { name: string; type: string; pluginId: string }[];
  uid: string;
  time: { from: string; to: string };
  timezone: string;
  panels: (Panel & { datasource: { uid: string } })[];
  templating: { list: { name: string; multi: boolean; datasource: { uid: string } }[] };
}

const dashboard = JSON.parse(
  readFileSync(resolve(__dirname, "../../../grafana/pilot-trend.dashboard.json"), "utf8"),
) as Dashboard;
const queries = dashboard.panels.flatMap((p) => p.targets.map((t) => t.query));

test("대시보드는 trace-pilot 버킷만 읽는다(NFR-04)", () => {
  expect(queries.length).toBeGreaterThan(0);
  for (const q of queries) {
    expect([...q.matchAll(/bucket: "([^"]+)"/g)].map((m) => m[1])).toEqual(["trace-pilot"]);
  }
});

test("배터리 건강도·사이클·벤치마크 패널이 한 화면에 있다", () => {
  const titles = dashboard.panels.map((p) => p.title).join(" | ");
  expect(titles).toContain("배터리 건강도");
  expect(titles).toContain("배터리 사이클");
  expect(titles).toContain("벤치마크");
});

test("측정이 한 번뿐이어도 점이 보이도록 모든 패널이 점을 그린다", () => {
  for (const p of dashboard.panels) expect(p.fieldConfig.defaults.custom.showPoints).toBe("always");
});

test("기기는 별칭(alias)으로만 고르고 실명·이메일 칸은 없다(FR-PIL-01)", () => {
  expect(dashboard.templating.list.map((v) => v.name)).toContain("alias");
  const text = JSON.stringify(dashboard);
  expect(text).not.toMatch(/email|realName|실명/i);
});

test("주소 링크와 맞도록 uid가 고정돼 있다", () => {
  expect(dashboard.uid).toBe("trace-pilot-trend");
});

test("별칭은 여러 개 고를 수 있다(FR-003)", () => {
  expect(dashboard.templating.list.find((v) => v.name === "alias")?.multi).toBe(true);
});

test("기본 기간은 최근 30일, 시간대는 Asia/Seoul이다(FR-005)", () => {
  expect(dashboard.time).toEqual({ from: "now-30d", to: "now" });
  expect(dashboard.timezone).toBe("Asia/Seoul");
});

test("데이터 소스는 Import 입력으로만 받고 토큰을 담지 않는다(FR-006)", () => {
  expect(dashboard.__inputs).toEqual([expect.objectContaining({ name: "DS_TRACE_PILOT", type: "datasource", pluginId: "influxdb" })]);
  for (const p of dashboard.panels) expect(p.datasource.uid).toBe("${DS_TRACE_PILOT}");
  for (const v of dashboard.templating.list) expect(v.datasource.uid).toBe("${DS_TRACE_PILOT}");
  expect(JSON.stringify(dashboard)).not.toMatch(/token|password|secret/i);
});

test("모든 쿼리는 시간순으로 정렬한다", () => {
  for (const q of queries) expect(q).toContain('sort(columns: ["_time"])');
});
