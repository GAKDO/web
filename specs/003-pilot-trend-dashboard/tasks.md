# Tasks: 파일럿 추이 대시보드

- [x] T001 대시보드 JSON 규칙 테스트 `src/shared/config/grafanaDashboard.test.ts` (FR-001~006)
- [x] T002 `grafana/pilot-trend.dashboard.json`: 변수 alias·metric, 패널 건강도·사이클·벤치마크(지표별 반복)
- [x] T003 링크 주소 테스트·구현 `src/shared/config/pilotDashboard(.test).ts` (FR-007)
- [x] T004 관리 메뉴 링크 테스트·구현 `RequireAdmin(.test).tsx` (US3)
- [x] T005 Dockerfile `ARG VITE_PILOT_DASHBOARD_URL`, `vite-env.d.ts` 타입
- [x] T006 (A) 이름 확정(contracts diagnostics/influx.md) → alias 대신 deviceId로 고침, 별칭은 값 매핑
- [x] T007a (A) 학교 Grafana 사용 승인, trace 접두사
- [ ] T007b Grafana에 trace 폴더·`trace-pilot` 데이터 소스 만들고 JSON Import, 기기 별칭표에 값 매핑 입력
- [x] T008 배포 워크플로 build-arg에 레포 변수 `PILOT_DASHBOARD_URL` 연결
- [ ] T008b (chan) Grafana 주소가 정해지면 GitHub 레포 변수 `PILOT_DASHBOARD_URL` 등록
- [ ] T009 DI2 배포 뒤 파일럿 기기 1대 두 번 측정 → 한 화면 확인(SC-001) → 시트 9행 체크

## Analyze 결과

- spec FR-001~007 ↔ T001~T005 모두 덮음. SC-001은 T006~T009(외부 의존) 뒤에만 확인 가능.
- 위험: Flux 쿼리는 실제 InfluxDB에 돌려 보지 못했다(세션에서 접근 불가). Import 뒤 첫 확인 때 고칠 수 있음.
