# Implementation Plan: 파일럿 추이 대시보드

**Spec**: [spec.md](./spec.md) · **Data**: [data-model.md](./data-model.md)

## 기술

- Grafana(학교 공용) 대시보드 JSON, InfluxDB Flux 쿼리, 데이터 소스는 가져오기 입력(`DS_TRACE_PILOT`)으로 받아 uid·토큰을 JSON에 넣지 않음.
- 웹(React 18 + Vite): 관리 메뉴에 새 탭 링크 하나. 주소는 빌드 변수 `VITE_PILOT_DASHBOARD_URL`(Dockerfile `ARG`).
- 테스트: Vitest. 대시보드 JSON 규칙 검사(버킷·패널·점 표시·별칭·uid)와 메뉴 링크 표시/숨김.

## 헌법 점검

- 계약 변경 없음(새 API 없음). 비밀 값 없음(토큰은 Grafana 데이터 소스에만). 자원은 `trace-pilot`만(NFR-04).
- MSW 목: 웹이 부르는 새 API가 없어 필요 없다.

## 구조

```
grafana/pilot-trend.dashboard.json      # Grafana에서 Import
src/shared/config/pilotDashboard.ts     # 링크 주소 읽기(http(s)만)
src/shared/auth/RequireAdmin.tsx        # 관리 메뉴에 링크
```

## 배포 메모

- Grafana: Dashboards → New → Import → JSON 붙여 넣기 → 데이터 소스로 `trace-pilot` Flux 소스 선택. uid가 `trace-pilot-trend`로 고정되어 주소는 `<grafana>/d/trace-pilot-trend`.
- 웹 이미지 빌드(deploy.yml)는 레포 변수 `PILOT_DASHBOARD_URL`을 `VITE_PILOT_DASHBOARD_URL` build-arg로 넘긴다. 변수가 비면 메뉴가 숨겨질 뿐 다른 화면은 그대로다.
