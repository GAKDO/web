# web

TRACE(노트북 렌탈 상태 기록 서비스)의 **화면**: 관리자 화면·고객 폰 촬영·3D 트윈 리포트·검증 페이지

- 담당: C
- 설계: [GAKDO/docs](https://github.com/GAKDO/docs) — REST API v0의 "화면별로 부르는 API" 표
- 기술: React, TypeScript, Vite, (three.js / React Three Fiber 예정)
- 폰 촬영은 카메라를 쓰므로 **HTTPS에서만** 동작합니다. 컨테이너는 `/etc/trace-tls/tls.crt`·`tls.key`가 있으면 8080을 HTTPS로 열고(`docker/40-trace-tls.sh`), 없으면 HTTP로 엽니다. 학교 클러스터에서는 gitops가 Secret `trace-tls`(gakdo.site 인증서)를 마운트합니다.
- 컨테이너 nginx는 입구 역할도 합니다(`docker/41-trace-upstreams.sh`가 시작할 때 주소를 만듦). 대상이 없어도 web은 뜨고 그 경로만 502입니다.

  | 경로 | 넘기는 곳 | 환경 변수(기본값) |
  |---|---|---|
  | `/api/` | gateway | `API_UPSTREAM`(`gateway:8080`) |
  | `/trace-captures/`·`/trace-derived/` | MinIO S3 API, Host도 이 값 | `MINIO_UPSTREAM`(`minio:9000`, 같은 Compose 안 MinIO) |

  capture-server가 사전 서명 URL 앞부분을 `MINIO_PUBLIC_BASE`(이 web 주소)로 바꿔 주므로, HTTPS 화면에서 http:// MinIO를 직접 부르지 않습니다. MinIO 경로는 객체 GET·HEAD·PUT만 넘깁니다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

## 빌드 설정값 (`VITE_*`, 빌드 때 화면에 박히므로 비밀 값은 넣지 않는다)

| 변수 | 뜻 | 기본값 |
|---|---|---|
| `VITE_API_BASE` | gateway 주소. 비우면 같은 출처의 `/api`(개발은 vite 프록시) | 비움 |
| `VITE_USE_MOCK` | `true`면 브라우저에서 MSW 목 서버를 켠다 | 비움 |
| `VITE_ARCHIVED_FEATURES` | MVP 배포에서 메뉴·링크를 숨기는 보관 기능(쉼표 구분): `phoneCapture`(수령 QR) `diagnostics`(페어링 코드) `report`(리포트 보기) `account`(가입·재설정) `pilot`(Grafana) `laterCheckpoints`(수령·반납 시작·렌탈 종료, MVP는 렌탈당 출고 검사 1번). 코드·주소는 그대로다 | 개발·테스트 비움, Docker 이미지는 `pilot`(폰 수령 촬영 `phoneCapture`는 폰 사진 검사 워커가 학교 서버 Compose에 올라가 11/8부터 보임, 수령·반납은 11/6부터 부스 빠른 검사로 보임, 가입·재설정·탈퇴 `account`와 리포트·내 렌탈·검증 `report`는 서버가 학교 서버에 올라가 11/6부터 보임, 진단 페어링 코드 `diagnostics`도 11/6부터 보임) |
| `VITE_PILOT_DASHBOARD_URL` | 파일럿 추이 Grafana 주소. 비우면 메뉴를 숨긴다 | 비움 |
| `VITE_DEMO_CUSTOMER_EMAILS` | 시연용 고객 계정 이메일(쉼표 구분). 로그인 화면에 고르기 버튼으로 보인다. 비밀번호는 넣지 않는다 | 비움(11/9부터 Docker 이미지도 비움, 운영 화면에 보이지 않게) |

## CI/CD

| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `화면 CI` | PR, develop push | 타입 검사 + 테스트 + 빌드 |
| `배포` | PR(빌드만), develop·main push | 이미지 → GHCR(`ghcr.io/<조직>/web`). main이면 gitops 이미지 태그 갱신 → Argo CD 배포 |
| `비밀값 검사`·`release`·알림 | | 다른 레포와 같음 |
