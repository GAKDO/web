# Tasks: 관리자 로그인·출고·반납·기기 관리 화면 (WE1)

**Input**: `specs/001-admin-rental-screens/` (spec.md, plan.md, research.md, data-model.md, contracts/ui-api-usage.md, quickstart.md)

**Tests**: 헌법 IV에 따라 수용 시나리오마다 테스트를 먼저 쓴다. 테스트 이름은 명세 문장 그대로.

**PR**: ① Phase 1·2·3(US1) → ② Phase 4·5(US2·US3) → ③ Phase 6(US4)·7. ②도 400줄을 넘어 ②-a(T023~T027 목록·상태)와 ②-b(T028~T032 고치기·등록)로, ③은 ③-a(T033~T035·T040 시점·상세)와 ③-b(T036~T039·T041a 목록·만들기)로 나눈다. ①의 코드가 400줄을 넘으면 ①-a(Phase 1·2 기반)와 ①-b(US1 로그인)로 나눈다. 모두 `develop`으로, 앞 PR이 머지된 뒤 다음 PR.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일이라 같이 할 수 있음
- 경로는 web 레포 기준

---

## Phase 1: Setup — PR ①

- [x] T001 의존성 추가: `react-router-dom@6.30`, `@tanstack/react-query@5`, `openapi-fetch@0.17` / dev: `openapi-typescript@7`, `msw@2.15`, `nanoid@5`, `@testing-library/user-event@14` (`package.json`, `package-lock.json`)
- [x] T002 `scripts/sync-contracts.sh` 작성: 인자 경로(기본 `../contracts`)에서 `openapi/auth-server.yaml`·`rental-server.yaml`·`components/*`·`codes.yaml`을 `contracts/`로 복사하고 `contracts/VERSION`에 커밋 SHA 기록
- [x] T003 contracts `4234950` 사본을 `contracts/`에 넣기 (T002 실행)
- [x] T004 `npm run gen:api` 스크립트: openapi-typescript로 `src/shared/api/generated/{auth,rental}.ts` 생성, 결과 커밋 (`package.json`)
- [x] T005 [P] 환경 값 `VITE_API_BASE`·`VITE_USE_MOCK` 타입 선언 (`src/vite-env.d.ts`)

## Phase 2: Foundational — PR ①

**⚠️ 이 단계가 끝나야 사용자 이야기를 시작할 수 있다**

- [x] T006 화면용 타입 별칭(`Device`, `DeviceModel`, `Rental`, `RentalSummary`, `Checkpoint`, `ErrorCode`, 코드 enum) (`src/shared/api/types.ts`)
- [x] T007 [P] 테스트: Problem Details → `ApiError` 변환(code·detail·네트워크 0) (`src/shared/api/problem.test.ts`)
- [x] T008 [P] `ApiError`·`toApiError` (`src/shared/api/problem.ts`)
- [x] T009 [P] 오류 문장 표 `Record<ErrorCode, string>`(ui-api-usage.md와 같게) + `messageFor(error, ctx)` (`src/shared/api/errorMessages.ts`)
- [x] T010 [P] 코드 이름표 `Record<DeviceStatus|...,string>` (`src/shared/codes/labels.ts`)
- [x] T011 [P] 메모리 토큰 저장소 `tokenStore` (`src/shared/auth/tokenStore.ts`)
- [x] T012 테스트: 401이면 refresh를 한 번만 부르고 원래 요청을 다시 보낸다 / 동시에 401이 여러 번 나도 refresh는 한 번 / 다시 401이면 세션을 비운다 (`src/shared/api/client.test.ts`)
- [x] T013 openapi-fetch 클라이언트 + 인증·401 재시도 미들웨어, `credentials: 'include'` (`src/shared/api/client.ts`)
- [x] T014 [P] MSW 메모리 db(기종 3, 기기 8, 렌탈 3, nanoid 21자, 테스트마다 초기화) (`src/shared/mocks/db.ts`)
- [x] T015 [P] MSW 인증 핸들러(login·refresh·logout, 고객 계정 하나 포함) (`src/shared/mocks/handlers/auth.ts`)
- [x] T016 MSW 서버·워커 연결과 Vitest 설정 (`src/shared/mocks/{node,browser,handlers/index}.ts`, `src/setupTests.ts`)
- [x] T017 [P] 공통 UI: Button(처리 중 잠금), Field·SelectField(레이블·오류), ConfirmDialog, ErrorBanner(다시 시도). ResponsiveList는 따로 두지 않고 CSS(768px부터 카드가 한 줄)로 처리 (`src/shared/ui/`)
- [x] T018 QueryClient·Router·개발 목 시작 (`src/main.tsx`, `src/App.tsx`), 기존 `App.test.tsx` 고치기

## Phase 3: US1 로그인·로그아웃 (P1) 🎯 MVP — PR ①

**Independent Test**: 목 관리자로 로그인 → 기기 목록, 로그아웃 → 로그인 화면

- [x] T019 [P] [US1] 테스트: 시나리오 1~8(로그인 성공, 틀린 비밀번호, 429, 토큰 만료 뒤 이어서, 리프레시 만료, 로그아웃, 고객 계정, 저장소에 토큰 없음) (`src/features/auth/LoginPage.test.tsx`, `src/shared/auth/AuthProvider.test.tsx`)
- [x] T020 [US1] AuthProvider(시작 때 refresh, 세션 상태 unknown·authenticated·anonymous, 로그아웃 때 Query 캐시 비우기) (`src/shared/auth/AuthProvider.tsx`)
- [x] T021 [US1] RequireAdmin 레이아웃 라우트와 관리자 메뉴·로그아웃 버튼 (`src/shared/auth/RequireAdmin.tsx`)
- [x] T022 [US1] 로그인 화면(오류 문장, 비밀번호 칸만 비우기, `?reason=expired` 안내) (`src/features/auth/components/LoginPage.tsx`)

**Checkpoint**: PR ① — 로그인만 되는 관리자 뼈대

---

## Phase 4: US2 기기 목록·검색·상태 바꾸기 (P1) — PR ②

**Independent Test**: 목 기기 8대로 거르기·검색·상태 바꾸기

- [x] T023 [P] [US2] MSW 기기·기종 핸들러(목록 거르기·q·커서, PATCH 상태 규칙과 409 `DEVICE_HAS_OPEN_RENTAL`) (`src/shared/mocks/handlers/device.ts`)
- [x] T024 [P] [US2] 테스트: 시나리오 1~8(기종·상태 거르기, 검색, 수리 중으로 바꾸기, 409 문장, 폐기 확인 창·목록에 남음, 폐기 → 수리 중만, 시리얼·기종 읽기 전용) (`src/features/devices/*.test.tsx`)
- [x] T025 [US2] 쿼리·뮤테이션 훅 `useDevices`, `useUpdateDevice` (`src/features/devices/api/`)
- [x] T026 [US2] 기기 목록 화면(거르기·검색·다음 쪽·빈 목록 안내) (`src/features/devices/components/DeviceListPage.tsx`)
- [x] T027 [US2] 상태 메뉴(data-model의 바꿀 수 있는 길만) (`src/features/devices/components/StatusMenu.tsx`)
- [x] T028 [US2] 기기 정보 고치기(색상·자산번호·OS). 계약에 기기 하나 조회(GET /devices/{id})가 없어 상세 화면 대신 목록 카드 안에서 고친다 (`src/features/devices/components/DeviceEditor.tsx`) — PR ②-b

## Phase 5: US3 기종·기기 등록 (P2) — PR ②

- [x] T029 [P] [US3] MSW 핸들러: 기기 등록(409 `DEVICE_SERIAL_EXISTS`), 기종 PUT (`src/shared/mocks/handlers/device.ts`)
- [x] T030 [P] [US3] 테스트: 시나리오 1~2(기종 선택 목록, 시리얼 중복 409). 시나리오 3~4(치수 검증, 같은 코드면 수정)는 T031과 함께 미룸 (`src/features/deviceModels/*.test.tsx`, `src/features/devices/DeviceCreatePage.test.tsx`)
- [ ] T031 [US3] (11/6 뒤로 미룸, 11/02 결정) 기종 목록·등록·수정 폼 (`src/features/deviceModels/`). 그때까지 기종은 A의 초기 데이터로 넣는다(c1-questions 10)
- [x] T032 [US3] 기기 등록 화면 (`src/features/devices/components/DeviceCreatePage.tsx`)

**Checkpoint**: PR ② — 기기·기종 관리 끝

---

## Phase 6: US4 렌탈과 세 시점 (P1) — PR ③

**Independent Test**: 렌탈 하나를 만들어 출고 → 수령 → 반납 → (봉인 뒤) 종료

- [x] T033 [P] [US4] 테스트: `nextAction(rental)` 표(data-model) 그대로 (`src/features/rentals/nextAction.test.ts`)
- [x] T034 [P] [US4] `nextAction` 순수 함수 (`src/features/rentals/nextAction.ts`)
- [x] T035 [P] [US4] MSW 렌탈 핸들러(생성 409 `DEVICE_NOT_ACTIVE`·`RENTAL_OPEN_EXISTS`, 시점 순서 409, 종료는 RET SEALED만, 반납 시작 뒤 몇 초 뒤 봉인, `?mock=slow-seal`이면 GRADED에서 멈춤) (`src/shared/mocks/handlers/rental.ts`)
- [ ] T036 [P] [US4] 테스트: 시나리오 1~10(+1-1 스위치) (`src/features/rentals/*.test.tsx`)
- [ ] T037 [US4] 훅 `useRentals`, `useRental`, `useCreateRental`, `useStartCheckpoint`, `useCloseRental` (409면 렌탈 다시 읽기) (`src/features/rentals/api/`)
- [ ] T038 [US4] 렌탈 목록 화면(계약 필드만) (`src/features/rentals/components/RentalListPage.tsx`)
- [ ] T039 [US4] 렌탈 만들기(기기 고르기 + "다른 상태 기기도 보기" 스위치, 대여자 참조 번호) (`src/features/rentals/components/RentalCreatePage.tsx`)
- [x] T040 [US4] 렌탈 상세와 시점 단계 표시·버튼·봉인 대기 안내 (`src/features/rentals/components/{RentalDetailPage,CheckpointSteps}.tsx`)

## Phase 7: 마무리 — PR ③

- [ ] T041 [P] 375px·1280px 렌더 테스트(matchMedia 목으로 카드·표 둘 다) (`src/shared/ui/ResponsiveList.test.tsx`)
- [ ] T041a [P] SC-006: 목 기기 100대에서 검색 결과가 1초 안에 보이는 테스트 (`src/features/devices/DeviceListPage.perf.test.tsx`)
- [ ] T042 [P] 기존 nginx·`/version.txt`·Dockerfile 그대로인지 확인, `npm run build` 통과
- [ ] T043 quickstart.md 순서대로 목 화면 확인, 스크린샷(375·1280) PR 본문에
- [ ] T043a (11/10 리허설로 미룸, 11/02 결정) SC-001·002: 팀 밖 3명이 설명 없이 로그인 → 렌탈 → 출고, 409 문장 이해 확인
- [ ] T044 c1-questions.md 답 반영(A 답이 오면 sync-contracts → gen:api → 타입 오류 고치기)

---

## Dependencies

- Phase 1 → Phase 2 → US1. US2·US3·US4는 Phase 2 뒤 서로 독립이지만, PR 순서 때문에 ② → ③.
- US4의 렌탈 만들기는 US2의 `useDevices`를 쓴다(T025 → T039).
- 각 단계 안: 테스트(실패 확인) → 구현 → 테스트 통과.

## Parallel Example (Phase 2)

T007·T009·T010·T011·T014·T015·T017은 서로 다른 파일이라 같이 진행할 수 있다. T012 → T013은 순서대로.

## Implementation Strategy

PR ①(로그인 MVP)부터 머지해 팀이 화면 뼈대를 볼 수 있게 하고, 마감(11/6)까지 ②·③을 낸다. 서버(AU1·RE1, 11/5)가 머지되면 quickstart "실제 서버로"를 한 번 돌린다.
