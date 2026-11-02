# Research: WE1 관리자 화면

## 1. 계약을 web으로 가져오는 방법

- **Decision:** contracts의 필요한 파일(`openapi/auth-server.yaml`·`rental-server.yaml`·`components/*`·`codes.yaml`)을 web 레포 `contracts/`에 고정 사본으로 두고, `scripts/sync-contracts.sh`가 복사하면서 `contracts/VERSION`에 커밋 SHA를 적는다. 생성 타입(`src/shared/api/generated/`)도 커밋한다.
- **Rationale:** CI가 다른 레포를 받지 않아도 되고, 어떤 계약 버전으로 만들었는지 PR에서 보인다. C1이 바뀌면 스크립트 한 번 + 타입 검사로 깨진 곳이 드러난다.
- **Alternatives:** git submodule(팀원 모두 submodule 사용법을 익혀야 하고 CI 토큰 필요), 빌드 때 GitHub raw에서 받기(네트워크 의존, 버전 고정 어려움), npm 패키지 발행(contracts 레포에 배포 파이프라인이 없음).

## 2. 타입 생성과 fetch 래퍼

- **Decision:** openapi-typescript 7로 `paths`·`components` 타입을 만들고, openapi-fetch 0.17로 부른다. 인증·401 재시도·Problem 파싱은 openapi-fetch 미들웨어 한 곳에 둔다. 화면은 `src/shared/api/types.ts`의 별칭(`Device`, `Rental`, `ErrorCode` …)만 import한다.
- **Rationale:** 경로·본문·응답이 계약과 어긋나면 컴파일 오류. CLAUDE.md의 "openapi-typescript + fetch 래퍼"와 같다. openapi-fetch는 6KB 정도의 얇은 fetch 래퍼다.
- **Alternatives:** 직접 쓴 fetch 래퍼 + 생성 타입(경로 문자열과 타입을 손으로 맞춰야 함), orval·openapi-generator(코드 생성량이 많고 400줄 규칙과 리뷰 부담).

## 3. 토큰 보관과 세션 되살리기

- **Decision:** 액세스 토큰은 모듈 메모리. 앱 시작·새 탭·401 때 `POST /api/v1/auth/refresh`를 `credentials: 'include'`로 부른다. 동시에 여러 401이 나면 하나의 refresh Promise를 공유한다.
- **Rationale:** FR-002·003·004. 리프레시는 HttpOnly 쿠키라 JS가 읽지 않는다(C1 auth-server login 응답).
- **Alternatives:** sessionStorage(새로 고침은 편하지만 FR-002 위반), BroadcastChannel로 탭 간 토큰 공유(새 탭도 refresh 한 번이면 되므로 불필요).

## 4. 라우터

- **Decision:** `react-router-dom` 6.30, `createBrowserRouter` + `RequireAdmin` 레이아웃 라우트.
- **Rationale:** React 18과 검증된 조합, SPA 라우팅만 필요(nginx `try_files` 이미 있음). v7은 프레임워크 모드 위주라 얻을 것이 없다.
- **Alternatives:** react-router 7(라이브러리 모드도 되지만 문서·예제가 프레임워크 모드 중심), TanStack Router(새로 배울 것 추가).

## 5. 목(MSW)

- **Decision:** MSW 2.15. 테스트는 `msw/node`의 `setupServer`, 개발은 `VITE_USE_MOCK=true`일 때 `setupWorker`. 데이터는 메모리 `db.ts`(nanoid 5로 21자 publicId), 테스트마다 초기화.
- **Rationale:** CLAUDE.md 지정. 서버(AU1·RE1, 11/5) 전에도 화면과 테스트를 끝낼 수 있다. MSW 3은 Node 22.12 이상만 받고 나온 지 얼마 안 돼 2.x를 쓴다.
- **Alternatives:** json-server(계약의 409 규칙을 흉내 내기 어려움), 테스트에서 fetch 직접 mock(개발 화면에서 다시 쓸 수 없음).

## 6. 코드 값 이름표

- **Decision:** `src/shared/codes/labels.ts`에 `Record<DeviceStatus, string>` 같은 표를 둔다(ACTIVE 사용 가능, MAINTENANCE 수리 중, RETIRED 폐기, OUT 출고, RCV 수령, RET 반납, OPEN 열림, CAPTURED 촬영됨, GRADED 등급 매김, SEALED 봉인, RENTAL OPEN 진행 중·RETURNED 반납됨·CLOSED 종료).
- **Rationale:** 값은 생성 타입에서만 오고(복사하지 않음), 값이 늘면 Record가 타입 오류로 알려 준다.

## 7. 오류 문장

- **Decision:** `Record<ErrorCode, string>`로 34개 code 모두에 문장을 둔다. WE1에서 실제로 보이는 code는 [contracts/ui-api-usage.md](./contracts/ui-api-usage.md)에 표로 둔다. 표에 없는 경우는 `detail` → 일반 문장 순.
- **Rationale:** FR-030. 서버의 `title`은 서버가 바꿀 수 있어 화면 문장의 원본으로 쓰지 않는다.

## 8. 반응형

- **Decision:** 768px 기준으로 표(데스크톱)·카드(폰) 전환, 일반 CSS + CSS 변수. 테스트는 `matchMedia` 목으로 두 폭 모두 렌더링 확인, 실제 375·1280 확인은 quickstart에서 사람이 한다.
- **Alternatives:** Tailwind·컴포넌트 라이브러리(의존 추가, 일정 대비 이득 작음).
