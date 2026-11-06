import { RefreshCw, Timer, Target } from "lucide-react";
import type { ReactNode } from "react";
import { CAPTURE_CAMERA_LABEL, CAPTURE_LIGHT_LABEL, DEFECT_CLASS_LABEL, INSPECTION_GRADE_LABEL } from "../../../shared/codes/labels";
import type { CaptureCamera, DefectClass } from "../../../shared/api/types";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { useBenchmarkData } from "../api/benchmark";
import { buildStats, GRADES } from "../model/stats";
import { ColumnChart } from "./ColumnChart";

// 분류 색(검증한 기본 팔레트 1·2번, 이웃 색각이상 ΔE 9 이상). 상태 색(문제 없음·있음)은 디자인 토큰을 쓴다
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const CAMS: CaptureCamera[] = ["CAM1", "CAM2"];

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="grid gap-0.5">
        <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
        {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <li className="grid gap-0.5 rounded-xl border bg-card px-3 py-2.5 shadow-xs md:p-4">
      <span className="text-[0.75rem] text-muted-foreground md:text-[0.8125rem]">{label}</span>
      <strong className="text-xl leading-tight font-bold tracking-tight tabular-nums md:text-2xl">{value}</strong>
      {sub && <span className="text-[0.6875rem] text-muted-foreground">{sub}</span>}
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** 서버에 아직 없는 값. 가짜 숫자를 넣지 않고 무엇이 있어야 그려지는지 적는다 */
function Missing({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex gap-3 rounded-xl border border-dashed bg-card p-4">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="grid gap-0.5">
        <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
        <p className="m-0 text-xs text-muted-foreground">{children}</p>
      </div>
    </section>
  );
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/**
 * 성능 그래프(Grafana 대신, 11/6). 서버가 이미 주는 검사 결과만 모아 그린다: 날짜별 판정, 등급 분포,
 * 조명·카메라별 흠집, 흠집 종류, 신뢰도 분포, 모델 버전. 판정 시간·모델 정확도는 계약에 없어 빈칸으로 둔다
 */
export function BenchmarkPage() {
  const data = useBenchmarkData();
  const s = buildStats(data.results);
  const has = s.graded > 0;

  return (
    <section>
      <PageHeader
        title="성능 그래프"
        description="부스 검사 결과를 모아 그래프로 봅니다. 서버에 저장된 검사 결과만 셉니다."
        actions={
          <Button onClick={data.refetch}>
            <RefreshCw aria-hidden="true" />
            새로 고침
          </Button>
        }
      />
      {data.rentals.isError && <ErrorBanner message="렌탈 목록을 불러오지 못했습니다." onRetry={() => void data.rentals.refetch()} />}
      {data.failed > 0 && <ErrorBanner message={`${data.failed}건을 불러오지 못해 빼고 셌습니다.`} onRetry={data.refetch} />}
      <p className="mt-0 mb-4 text-xs text-muted-foreground" aria-live="polite">
        {data.loading ? "불러오는 중… " : ""}렌탈 {data.rentalCount}건 · 등급이 나온 시점 {s.graded}건 기준
        {s.ungraded > 0 ? ` · 판정 대기·판정 불가 ${s.ungraded}건 제외` : ""}
        {data.truncated ? " · 렌탈이 더 있지만 최근 것만 셌습니다" : ""}
      </p>

      <ul className="m-0 mb-4 grid list-none grid-cols-2 gap-2 p-0 md:grid-cols-4 md:gap-3">
        <Stat label="검사한 시점" value={String(s.graded)} />
        <Stat label="문제 있음 비율" value={pct(s.bad, s.graded)} sub={`문제 있음 ${s.bad} · 없음 ${s.ok}`} />
        <Stat label="찾은 흠집" value={String(s.defectCount)} sub="사진마다 센 수" />
        <Stat label="평균 신뢰도" value={s.meanConfidence === null ? "—" : `${Math.round(s.meanConfidence * 100)}%`} />
      </ul>

      <div className="grid gap-3 md:grid-cols-2">
        <Card title="날짜별 판정" note="촬영이 끝난 날(서울 시간)마다 문제 없음·있음 건수">
          {s.byDay.length ? (
            <ColumnChart
              title="날짜별 판정"
              columns={s.byDay.map((d) => ({ label: d.day.slice(5), values: [d.ok, d.bad] }))}
              series={[
                { name: "문제 없음", color: "var(--success)" },
                { name: "문제 있음", color: "var(--destructive)" },
              ]}
            />
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "등급이 나온 검사가 아직 없습니다."}</Empty>
          )}
        </Card>
        <Card title="등급 분포" note="A = 문제 없음, B~D = 문제 있음(서버가 매긴 등급)">
          {has ? (
            <ColumnChart title="등급 분포" columns={GRADES.map((g) => ({ label: INSPECTION_GRADE_LABEL[g], values: [s.grades[g]] }))} series={[{ name: "시점", color: SERIES_1 }]} />
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "등급이 나온 검사가 아직 없습니다."}</Empty>
          )}
        </Card>
        <Card title="조명·카메라별 찾은 흠집" note="같은 흠집도 조명마다 따로 셉니다. 어느 조명에서 흠집이 잘 보이는지 비교합니다(부스 빠른 검사 사진)">
          {s.byLight.length ? (
            <ColumnChart
              title="조명·카메라별 찾은 흠집"
              unit="개"
              columns={s.byLight.map((l) => ({ label: CAPTURE_LIGHT_LABEL[l.light], values: CAMS.map((c) => l.cams[c] ?? 0) }))}
              series={CAMS.map((c, i) => ({ name: CAPTURE_CAMERA_LABEL[c], color: i === 0 ? SERIES_1 : SERIES_2 }))}
            />
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "사진별 흠집이 아직 없습니다."}</Empty>
          )}
        </Card>
        <Card title="흠집 신뢰도 분포" note="모델이 흠집이라고 본 확신 정도(0~100%) 구간별 개수">
          {s.defectCount ? (
            <ColumnChart title="흠집 신뢰도 분포" unit="개" columns={s.confidence.map((b) => ({ label: b.label.split("~")[0], values: [b.count] }))} series={[{ name: "흠집", color: SERIES_1 }]} />
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "찾은 흠집이 아직 없습니다."}</Empty>
          )}
        </Card>
        <Card title="흠집 종류" note="종류별로 찾은 흠집 수">
          {s.byClass.length ? (
            <ColumnChart title="흠집 종류" unit="개" columns={s.byClass.map((b) => ({ label: DEFECT_CLASS_LABEL[b.label as DefectClass] ?? b.label, values: [b.count] }))} series={[{ name: "흠집", color: SERIES_1 }]} />
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "찾은 흠집이 아직 없습니다."}</Empty>
          )}
        </Card>
        <Card title="모델 버전" note="흠집을 찾은 모델 버전별 개수">
          {s.modelVersions.length ? (
            <ul className="m-0 grid list-none gap-1 p-0 text-sm">
              {s.modelVersions.map((m) => (
                <li key={m.label} className="flex justify-between gap-3 border-b py-1.5 last:border-b-0">
                  <code className="truncate text-xs">{m.label}</code>
                  <span className="tabular-nums">{m.count}개</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{data.loading ? "불러오는 중…" : "찾은 흠집이 아직 없습니다."}</Empty>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Missing icon={<Timer className="size-5" />} title="부스 판정 시간">
          부스가 버튼부터 판정까지 걸린 시간(목표 30초)을 재지만 아직 서버로 보내지 않아 그래프로 그릴 수 없습니다.
        </Missing>
        <Missing icon={<Target className="size-5" />} title="모델 정확도(mAP)">
          학습 결과(검증 기기 MB04·MB13·MB16)가 서버에 아직 없어 그래프로 그릴 수 없습니다.
        </Missing>
      </div>
    </section>
  );
}
