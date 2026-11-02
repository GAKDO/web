# Implementation Plan: 관리자 로그인·출고·반납·기기 관리 화면 (WE1)

**Branch**: `claude/project-thread-sddz4v` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-admin-rental-screens/spec.md`

## Summary

관리자용 화면 4묶음(로그인, 기기 목록·상태, 기종·기기 등록, 렌탈·세 시점)을 web 레포에 만든다. API 타입은 contracts C1 OpenAPI(`rental-server.yaml`·`auth-server.yaml`, PublicId 반영 커밋 `4234950`)를 web 안에 고정 사본으로 가져와 openapi-typescript로 만들고, 호출은 `src/shared/api/` 한 곳의 fetch 래퍼(openapi-fetch + 인증 미들웨어)로만 한다. 서버(AU1·RE1)가 뜨기 전까지 같은 계약을 따르는 MSW 목으로 개발·테스트하고, 같은 목을 `npm run dev`에서도 켤 수 있게 한다. 액세스 토큰은 메모리에만 두고, 새로 고침 때는 리프레시 쿠키로 다시 받는다.

## Technical Context

**Language/Version**: TypeScript 5.9(strict), React 18.3, Node 22(빌드·테스트)

**Primary Dependencies**: Vite 6, React Router(`react-router-dom` 6.30), TanStack Query 5, openapi-typescript 7(타입 생성, dev), openapi-fetch 0.17(fetch 래퍼), MSW 2.15(목), nanoid 5(목 데이터 ID). 결정 근거는 [research.md](./research.md).

**Storage**: 없음. 액세스 토큰은 모듈 메모리 변수. 서버 상태는 TanStack Query 캐시(로그아웃 때 비움). localStorage·sessionStorage·IndexedDB를 쓰지 않는다.

**Testing**: Vitest 3 + Testing Library(+ user-event) + MSW(node). 수용 시나리오 문장을 테스트 이름으로 쓴다(헌법 IV).

**Target Platform**: 최신 Chrome·Safari(데스크톱 1280px, 폰 375px). nginx 정적 서빙(8080, `/version.txt` 유지).

**Project Type**: 단일 SPA(web 레포), 관리자 화면은 `/admin` 아래 라우트.

**Performance Goals**: 기기 100대 목록 검색 결과 1초 안(SC-006). 목록은 커서로 20개씩.

**Constraints**: 토큰 저장 금지(FR-002), 계약 타입만 사용(`any` 금지), 375px 가로 스크롤 없음, PR 하나에 코드 400줄 이하(넘으면 나눔 — 아래 "PR 나누기").

**Scale/Scope**: 화면 8개(로그인, 기기 목록, 기기 등록, 기기 상세·수정, 기종 목록·등록, 렌탈 목록, 렌탈 만들기, 렌탈 상세), API 14개 operation.

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 뒤 다시 확인.*

| 원칙 | 점검 | 결과 |
| --- | --- | --- |
| I. 계약이 먼저 | API 타입은 C1 OpenAPI에서 생성만 하고 손으로 쓰지 않는다. 코드 값은 `codes.gen.yaml`이 만든 enum 타입만 쓰고 한국어 이름표만 화면에 둔다. 계약과 다른 화면 결정(폐기 되돌리기)은 `c1-questions.md`로 A에게 묻는다. 계약에 없는 필드가 필요한 곳(렌탈 목록의 대여자 참조 번호·지금 시점, 렌탈 상세의 시리얼)은 더하는 변경을 요청하고, 그 전에는 화면이 계약 필드만 쓴다 | 통과 |
| II. 서비스 경계 | 화면은 gateway `/api/v1/...`만 부른다 | 통과 |
| III. 기록은 고칠 수 없다 | 기기 삭제 없음, 폐기는 상태로만. 폐기 → 수리 중 되돌리기는 화면 결정이고 서버 규칙 확인 대기 | 통과(질문 열림) |
| IV. 테스트와 품질 게이트 | 수용 시나리오마다 Vitest 테스트, `npm run typecheck && npm test && npm run build` | 통과 |
| V. 비밀과 개인정보 | 토큰은 메모리에만, 로그에 토큰·이메일을 남기지 않음, 대여자는 참조 번호만. 목의 계정·비밀번호는 예시 값(`admin@example.com`)만 | 통과 |
| VI. 단순하게 | QR·페어링 화면 제외(명세 가정), 상태 관리 라이브러리 추가 없음(Query + React 상태) | 통과 |
| ID 규칙(1.1.0) | 화면·URL·목은 publicId만. 목 ID는 nanoid 21자. 숫자 id 없음 | 통과 |

Phase 1 뒤 재점검: data-model·contracts가 계약 필드만 쓰는지 확인함 — 통과.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-rental-screens/
├── spec.md
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ui-api-usage.md  # 화면 × operation × 오류 code → 문장
├── c1-questions.md      # A에게 묻는 것
└── checklists/requirements.md
```

### Source Code (repository root)

```text
contracts/                     # C1 고정 사본(손으로 고치지 않음)
├── VERSION                    # contracts 커밋 SHA
├── codes.yaml
└── openapi/{auth-server,rental-server}.yaml, components/{common,codes.gen}.yaml
scripts/
└── sync-contracts.sh          # ../contracts(또는 인자 경로)에서 위 파일을 복사하고 VERSION 기록
src/
├── main.tsx                   # QueryClient·Router·(개발 목) 시작
├── App.tsx                    # 라우트
├── shared/
│   ├── api/
│   │   ├── generated/         # openapi-typescript 출력(커밋, 손으로 고치지 않음)
│   │   ├── types.ts           # 화면이 쓰는 타입 별칭 — C1이 바뀌면 여기만 고침
│   │   ├── client.ts          # openapi-fetch 클라이언트 + 인증·401 재시도 미들웨어
│   │   ├── problem.ts         # Problem Details 파싱, ApiError
│   │   └── errorMessages.ts   # error_code → 한국어 문장(Record<ErrorCode, string>)
│   ├── auth/                  # tokenStore(메모리), AuthProvider, RequireAdmin
│   ├── codes/labels.ts        # 코드 값 → 한국어 이름표(Record<DeviceStatus, string> 등)
│   ├── ui/                    # Button, Field, ConfirmDialog, ErrorBanner, ResponsiveList
│   └── mocks/                 # MSW: db.ts(메모리 데이터, nanoid), handlers/{auth,rental,device}.ts, browser.ts, node.ts
└── features/
    ├── auth/      (components: LoginPage)
    ├── devices/   (components: DeviceListPage, DeviceCreatePage, DeviceDetailPage, StatusMenu / api: hooks)
    ├── deviceModels/ (components: DeviceModelListPage, DeviceModelForm / api)
    └── rentals/   (components: RentalListPage, RentalCreatePage, RentalDetailPage, CheckpointSteps / api)
tests/ 대신 각 폴더 옆 *.test.tsx (기존 App.test.tsx 방식 유지)
```

**Structure Decision**: 기존 web 단일 SPA에 컨벤션(`src/features/<기능>/`, `src/shared/`)대로 더한다. API에 닿는 코드는 `src/shared/api/` 밖에 두지 않는다(FR-034).

## 주요 설계

- **토큰(FR-002~006):** `tokenStore`는 모듈 변수 하나(`accessToken`, `role`, `expiresAt`). 앱 시작 때 `POST /auth/refresh`(credentials: include)를 한 번 불러 세션을 되살린다. 401이면 미들웨어가 refresh를 한 번만(진행 중 Promise 공유) 부르고 원래 요청을 다시 보낸다. 다시 401이면 tokenStore·Query 캐시를 비우고 `/admin/login?reason=expired`로 보낸다. 로그인 응답 `role`이 ADMIN이 아니면 토큰을 버리고 안내만 보인다.
- **오류 문장(FR-030·031):** `ApiError{status, code, detail}` 하나로 바꾼다. `errorMessages`는 `Record<ErrorCode, string>`라 codes.yaml에 code가 늘면 타입 검사가 빠진 문장을 잡는다. `DEVICE_NOT_ACTIVE`는 화면이 아는 기기 상태로 "수리 중"/"폐기"를 넣어 문장을 만든다.
- **시점 버튼(FR-022·023):** 렌탈 상세의 `checkpoints`만 보고 다음 시점(OUT → RCV → RET)과 종료 가능(RET.status === SEALED)을 계산하는 순수 함수 `nextAction(rental)` 하나. 409(`CHECKPOINT_ORDER_VIOLATION`·`RENTAL_NOT_CLOSABLE`)면 문장을 보이고 렌탈을 다시 읽는다.
- **목(MSW):** `db.ts`가 기종 3·기기 8(사용 가능 5, 수리 중 2, 폐기 1)·렌탈 3(출고만, 반납 봉인 전, 반납 봉인)을 nanoid로 만든다. 핸들러는 계약의 409 규칙을 그대로 흉내 내고, 개발용 `?mock=slow-seal`이면 반납 시점을 GRADED에서 멈춘다(봉인 지연 시나리오). 응답 모양은 생성된 타입으로 검사한다(`satisfies`).
- **반응형(FR-032):** `ResponsiveList`가 `matchMedia('(min-width: 768px)')`로 표·카드를 고른다. CSS는 기존처럼 일반 CSS 파일(새 라이브러리 없음).
- **설정:** `VITE_API_BASE`(비우면 같은 출처 `/api`, 개발은 vite 프록시), `VITE_USE_MOCK=true`면 브라우저 MSW 시작. 비밀 값 없음.

## PR 나누기 (코드 400줄 규칙)

`contracts/`·`generated/`·`specs/`는 셈에서 뺀다. 그래도 넘을 것으로 보여 develop으로 PR 3개를 차례로 낸다.

1. 기반: 계약 사본·생성 타입·API 클라이언트·토큰·오류 문장·MSW db·로그인 화면(US1)
2. 기기·기종(US2·US3)
3. 렌탈·시점(US4)

## 위험·의존

- C1에 없는 필드: `RentalSummary`에 `renterRef`·지금 시점이 없고, `Rental`에 시리얼·기종이 없다. 그 전까지 렌탈 목록은 시리얼·기종·상태·만든 날만, 상세는 목록에서 넘어온 캐시의 시리얼을 보이고(직접 주소로 들어오면 "기기 정보는 목록에서 확인") 한다. 더하는 변경을 `c1-questions.md`로 요청한다.
- 리프레시 쿠키는 `Path=/api/v1/auth; SameSite=Strict`이고 web(8315)과 gateway(8314)는 출처가 다르다. 학교 배포에서 쿠키가 실리려면 gateway CORS가 web 출처를 `credentials` 허용으로 열거나, web nginx가 `/api`를 gateway로 넘겨야 한다. GW1(A)과 정한다.
- 렌탈 종료는 반납 봉인(RP1까지)에 달려 있다(명세 Risks).

## Complexity Tracking

헌법 위반 없음.
