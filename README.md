# web

TRACE(노트북 렌탈 상태 기록 서비스)의 **화면**(https://gakdo.site): 관리자 화면·사람 검수·고객 폰 촬영·3D 리포트·보유 노트북 3D·검증 페이지·챗봇 창

- 담당: C
- 설계: [GAKDO/docs](https://github.com/GAKDO/docs) — REST API v0의 "화면별로 부르는 API" 표
- 기술: React 18, TypeScript(strict), Vite 6, React Router, TanStack Query, Tailwind CSS 4, three.js + React Three Fiber·drei(3D), API 타입은 contracts OpenAPI에서 생성. 테스트는 Vitest + Testing Library + MSW
- 폰 촬영은 카메라를 쓰므로 **HTTPS에서만** 동작합니다. 컨테이너는 `/etc/trace-tls/tls.crt`·`tls.key`가 있으면 8080을 HTTPS로 열고(`docker/40-trace-tls.sh`), 없으면 HTTP로 엽니다. 학교 클러스터에서는 gitops가 Secret `trace-tls`(gakdo.site 인증서)를 마운트합니다.
- 컨테이너 nginx는 입구 역할도 합니다(`docker/41-trace-upstreams.sh`가 시작할 때 주소를 만듦). 대상이 없어도 web은 뜨고 그 경로만 502입니다.

  | 경로 | 넘기는 곳 | 환경 변수(기본값) |
  |---|---|---|
  | `/api/` | gateway | `API_UPSTREAM`(`gateway:8080`) |
  | `/trace-captures/`·`/trace-derived/` | MinIO S3 API, Host도 이 값 | `MINIO_UPSTREAM`(`minio:9000`, 같은 Compose 안 MinIO) |
  | `/agent.sh`·`/agent.ps1` | 진단 에이전트 한 줄 설치 스크립트(GitHub `GAKDO/agent` 태그 원본으로 302, 맥 v0.3.0·Windows v0.2.0) | `nginx.conf`에 고정 |

  실제 사용자 IP: `TRUSTED_PROXIES`(쉼표로 IP·CIDR, Compose는 `.env`의 `WEB_TRUSTED_PROXIES`)에서 온 연결만 `X-Forwarded-For`를 믿고 그 IP를 gateway 요청 제한 키로 넘깁니다. 비우면 연결 주소를 씁니다.

  capture-server가 사전 서명 URL 앞부분을 `MINIO_PUBLIC_BASE`(이 web 주소)로 바꿔 주므로, HTTPS 화면에서 http:// MinIO를 직접 부르지 않습니다. MinIO 경로는 객체 GET·HEAD·PUT만 넘깁니다.

## 화면

| 누가 | 주소 | 하는 일 |
|---|---|---|
| 누구나 | `/`, `/guide` | 첫 화면, 이용 안내 |
| 누구나 | `/devices`, `/devices/:deviceId` | 보유 노트북 비교(등급·흠집 수·배터리·벤치마크), 외관 3D 위 흠집 점을 누르면 그 사진 |
| 누구나 | `/verify/:verifyToken` | 봉인 기록 검증(해시 체인·서명 다시 계산) |
| 누구나 | `/privacy`, `/terms`, `/licenses` | 개인정보 처리방침, 이용약관, 오픈소스 고지 |
| 누구나 | 오른쪽 아래 챗봇 창 | 사이트 도우미(chat-server, 로그인하면 내 렌탈도 읽기만) |
| 고객 | `/login`, `/signup`, `/password/reset` | 이메일·구글·깃허브 로그인(키가 있으면 카카오·네이버), 가입·이메일 인증, 비밀번호 재설정 |
| 고객 | `/capture` | 수령 QR로 들어와 렌탈 연결, 폰으로 수령 촬영(HTTPS 카메라) |
| 고객 | `/my/rentals`, `/my/rentals/:rentalId` | 내 렌탈, 시점별 사진·흠집 비교·3D 리포트·정산 |
| 고객 | `/my/account`, `/my/account/withdraw` | 내 계정, 탈퇴(소셜 가입자는 로그인 10분 안이면 비밀번호 없이) |
| 관리자 | `/admin/models`, `/admin/devices`, `/admin/rentals` | 기종·기기 등록(라벨 사진 글자 읽기), 렌탈 열기, 시점 시작, 부스 6자리 코드, 진단 페어링 코드와 에이전트 설치 명령 복사, 진단 다시 하기 |
| 관리자 | `/admin/inspections` | 검사 결과·등급, **사람 검수**(AI 후보 확정·기각, 놓친 흠집 직접 그리기) |
| 관리자 | `/admin/benchmark` | 기기별 진단 추이(배터리·SSD·벤치마크) |
| 관리자 | `/booth` | 부스 옆 태블릿용: 검사 기다리는 기기 고르기 → 부스 코드 → 판정·사진 |

## 실행

```bash
npm ci
```

```bash
npm run dev
```

API 없이 화면만 보려면 `VITE_USE_MOCK=true npm run dev`(MSW 목 서버).

```bash
npm run typecheck && npm test   # 검사
npm run build                   # 빌드
```

`npm ci` 뒤 `npm test`(= `vitest run`)만 하면 됩니다. 테스트는 진짜 서버 없이 MSW 가짜 API(`src/shared/mocks`)로 돌고,
카메라처럼 브라우저 장치가 필요한 부분은 테스트 안에서 가짜로 바꿔 끼웁니다. 그래서 건너뛰는 테스트가 없습니다.
테스트 파일마다 맨 위에 "이 파일이 확인하는 것"을, 테스트마다 `[상황]`·`[기대]`를 한국어로 적어 두었습니다.

컨테이너는 기존 nginx Dockerfile(8080, `/version.txt`)을 씁니다.

## 빌드 설정값 (`VITE_*`, 빌드 때 화면에 박히므로 비밀 값은 넣지 않는다)

| 변수 | 뜻 | 기본값 |
|---|---|---|
| `VITE_API_BASE` | gateway 주소. 비우면 같은 출처의 `/api`(개발은 vite 프록시) | 비움 |
| `VITE_USE_MOCK` | `true`면 브라우저에서 MSW 목 서버를 켠다 | 비움 |
| `VITE_ARCHIVED_FEATURES` | 메뉴·링크를 숨기는 보관 기능(쉼표 구분): `phoneCapture`(수령 QR) `diagnostics`(페어링 코드) `report`(리포트 보기) `account`(가입·재설정) `pilot`(Grafana) `laterCheckpoints`(수령·반납 시작·렌탈 종료). 코드·주소는 그대로다 | 개발·테스트 비움, Docker 이미지는 `pilot`만(나머지는 11/6~11/8에 서버가 올라가 모두 보임) |
| `VITE_PILOT_DASHBOARD_URL` | 파일럿 추이 Grafana 주소. 비우면 메뉴를 숨긴다 | 비움 |
| `VITE_DEMO_CUSTOMER_EMAILS` | 시연용 고객 계정 이메일(쉼표 구분). 로그인 화면에 고르기 버튼으로 보인다. 비밀번호는 넣지 않는다 | 비움(11/9부터 Docker 이미지도 비움, 운영 화면에 보이지 않게) |

## CI/CD

| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `화면 CI` | PR, develop push | 타입 검사 + 테스트 + 빌드 |
| `배포` | PR(빌드만), develop·main push(`.md`만 바뀌면 건너뜀) | 이미지 → GHCR(`ghcr.io/<조직>/web`, develop은 `:develop`). 지금 운영(https://gakdo.site, 학교 서버 Compose)은 gitops `compose/ops/autodeploy.sh`가 3분마다 `:develop`을 받아 바꾼다(web은 1~2초 끊김). main이면 gitops `overlays/school` 이미지 태그도 바꾼다(클러스터 경로, 지금은 쓰지 않음) |
| `비밀값 검사`·`release`·알림 | | 다른 레포와 같음 |
