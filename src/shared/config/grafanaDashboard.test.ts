// grafana/pilot-trend.dashboard.json이 FR-PIL-02와 trace-pilot 쓰기 규칙(specs/002 data-model.md)에 맞는지 본다
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Panel {
  title: string;
  targets: { query: string }[];
  fieldConfig: { defaults: { custom: { showPoints: string } } };
}
interface Dashboard {
  uid: string;
  panels: Panel[];
  templating: { list: { name: string }[] };
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
