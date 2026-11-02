# Tasks: 고객 렌탈 목록·3D 리포트 화면 (WE3)

**Input**: `specs/003-customer-report/` (spec.md, plan.md, contracts/ui-api-usage.md)

**Tests**: 헌법 IV. 수용 시나리오마다 테스트를 먼저 쓰고, 이름은 명세 문장 그대로.

**PR**: WE2 기반 PR(고객 로그인·`RequireCustomer`·capture 타입) 머지 → develop 받기 → ① Phase 1·2·3(US1) → ② Phase 4(US4) → ③ Phase 5(US2·US3, 넘치면 ③-a/③-b) → ④ Phase 6(US5)·7. 모두 `develop`으로, 앞 PR이 머지된 뒤 다음 PR. 각 PR은 팀원 1명 승인이 필요하다.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup — PR ①

- [ ] T001 `scripts/sync-contracts.sh`·`gen:api`에 `report-server.yaml`·`diagnostics-server.yaml`(+ `diagnostics/result.schema.json` 참조) 더하기, contracts `fd35e33` 사본, `src/shared/api/generated/{report,diagnostics}.ts` 생성
- [ ] T002 `src/shared/api/types.ts`에 별칭 덧붙임: `RentalTimeline`, `TimelineCheckpoint`, `Pin`, `ProgressEvent`, `DoneEvent`, `CheckpointDiagnostics`, `InspectionFlag`, `Inspection`, `Defect`, `CheckpointMedia`, `MeResponse`, 코드 enum(`InspectionGrade`, `InspectionDefectClass`, `DiagnosticsFlagKind`, `ReportProgressStage`, `ReportChainStatus`, `CaptureFace`)
- [ ] T003 [P] `src/shared/codes/labels.ts`에 이름표 덧붙임(흠집 종류, 플래그 문장, 진행 단계, 체인 상태, 면)
- [ ] T004 [P] 의존성: `three`, `@react-three/fiber@8`, `@react-three/drei@9`, `@microsoft/fetch-event-source@2`

## Phase 2: Foundational — PR ①

- [ ] T005 목 데이터 `src/shared/mocks/report.ts`: 고객 렌탈 2개(시점·핀·검사·진단·텍스처 SVG data URL), `resetDb`에 묶기
- [ ] T006 [P] 목 핸들러 `handlers/report.ts`(타임라인, 본인 아니면 403 OUT_OF_SCOPE), `handlers/capture-report.ts`(inspection·media), `handlers/diagnostics.ts`(checkpoints), `handlers/rental.ts`의 GET 두 개를 고객 본인 것으로 열기, `GET /device-models/{modelCode}` 고객 허용
- [ ] T007 `src/features/report/api/report.ts` 쿼리 훅(useMyRentals, useTimeline, useInspection, useCheckpointMedia, useDiagnostics, useDeviceModel)
- [ ] T008 `renderAsCustomer(path)` 테스트 도우미 (`src/test/renderApp.tsx`)

## Phase 3: US1 내 렌탈 목록·리포트 틀 (P1) — PR ①

- [ ] T009 [US1] 테스트: 목록 2개/없음, 리포트 세 시점 카드·"아직 진행 전", 403 문장 + 목록 버튼, 404 문장, 체인 경고 (`src/features/report/MyRentals.test.tsx`, `Report.test.tsx`)
- [ ] T010 [US1] `MyRentalsPage`, `ReportPage`(시점 카드·체인 경고·검증 링크·오류), 라우트 `/my/rentals`, `/my/rentals/:rentalId`
- [ ] T011 [US1] 관리자 렌탈 상세에 "리포트 보기" 링크 (`RentalDetailPage.tsx`)

## Phase 4: US4 비교표 (P1) — PR ②

- [ ] T012 [P] [US4] 단위 테스트 + `model/compare.ts`(등급·신규 흠집·배터리 %·차이 %p·사이클·SSD 사유·플래그 문장)
- [ ] T013 [US4] 테스트: 두 시점 비교, 플래그 문장, 읽지 못함 + 사유, 크롭 썸네일 (`Compare.test.tsx`)
- [ ] T014 [US4] `CompareTable`(1280 표, 375 카드)

## Phase 5: US2·US3 3D 트윈·핀·슬라이더 (P1) — PR ③

- [ ] T015 [P] [US3] 단위 테스트 + `model/timeline.ts`(슬라이더에 올릴 시점 = 봉인된 시점, 고른 시점의 핀·신규 구분)
- [ ] T016 [P] [US2] 단위 테스트 + `model/pins.ts`(면 → 상자 면 대응, 핀 px → 3D 위치, 범위 밖 핀 버림)
- [ ] T017 [US3] 테스트(대체 화면 기준): 슬라이더 출고 → 수령에 신규 핀 1개 "신규" 표시, 되돌리면 사라짐, 핀 누르면 크롭·종류·면·크기, 검사 중 시점은 "검사 중", 화살표 키 (`Twin.test.tsx`)
- [ ] T018 [US2] 테스트: 사진 없는 면 "사진 없음", WebGL 없으면 대체 화면, 사진 주소 만료 전 다시 받기
- [ ] T019 [US3] `CheckpointSlider`, `PinDetail`, `TwinFallback`
- [ ] T020 [US2] `TwinViewer`(lazy, R3F 캔버스, 상자 두 개 110°, 텍스처, OrbitControls, 처음 보기, 핀 메시 + 누르기)
- [ ] T021 [US2] `useCheckpointMedia` 만료 1분 전 새로 받기

## Phase 6: US5 검사 진행률 (P2) — PR ④

- [ ] T022 [US5] 테스트: progress 이벤트로 단계·퍼센트 바뀜, done이면 리포트 다시 읽기, 모두 봉인이면 연결 안 함, 끊기면 "다시 연결 중" (`Progress.test.tsx`, 스트림 목)
- [ ] T023 [US5] `useProgress`(fetchEventSource, 401이면 refresh 뒤 다시), `ProgressBadge`, 목 스트림 핸들러

## Phase 7: 마무리 — PR ④

- [ ] T024 375px·1280px 스크린샷(목, `npm run dev`)을 프로젝트 파일 `we3/screenshots/`에 남김
- [ ] T025 `npm run typecheck && npm test && npm run build`, 묶음 크기 확인(3D가 따로 나뉘었는지)
- [ ] T026 각 PR 머지 뒤 시트 13·17·18·19·20행 비고(F열)만 고침. 체크는 실제 서버 확인 뒤
